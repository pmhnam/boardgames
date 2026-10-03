import type { BotDecisionInput, BotStrategy, SeededRandom } from '@bgp/game-core';
import type { SplendorAction } from '../domain/actions.js';
import type { Noble } from '../domain/cards.js';
import { TOKEN_COLORS, emptyTokens, type TokenColor, type TokenCounts } from '../domain/gems.js';
import { getExcessTokens } from '../rules/gems.rules.js';
import { listLegalActions } from '../rules/legal-moves.js';
import { getEligibleNobles } from '../rules/noble.rules.js';
import type { SplendorView } from '../visibility/public-view.js';
import { evaluate } from './evaluate.js';
import { applyToModel, asSeenBy, getPlannedMoves, readView, type Model } from './model.js';

/** How often the easy bot reserves a card rather than take gems. */
const EASY_RESERVE_CHANCE = 0.2;
/** How much a gain a turn later counts next to one now. */
const FORESIGHT = 0.85;
/** How many of its own turns the hard bot plans. */
const PLAN_DEPTH = 3;
/** First moves the hard bot plans beyond, and continuations it follows from each. */
const ROOT_WIDTH = 10;
const PLAN_WIDTH = 4;
/** How much the strongest opponent's position counts against a move: more in a duel. */
const RIVALRY_DUEL = 0.35;
const RIVALRY_TABLE = 0.2;

/** Picks the best-scoring option; ties are broken at random so games do not repeat. */
function pickBest<T>(options: readonly T[], value: (option: T) => number, random: SeededRandom): T {
  let best: T[] = [];
  let bestValue = -Infinity;
  for (const option of options) {
    const optionValue = value(option);
    if (optionValue > bestValue) {
      best = [option];
      bestValue = optionValue;
    } else if (optionValue === bestValue) {
      best.push(option);
    }
  }
  return random.pick(best);
}

/** Gives back the tokens whose loss hurts least, one at a time. */
export function chooseReturn(model: Model, count: number, aware: boolean): Partial<TokenCounts> {
  const returned = emptyTokens();
  let current = model;
  for (let given = 0; given < count; given += 1) {
    let best: { color: TokenColor; after: Model; value: number } | null = null;
    for (const color of TOKEN_COLORS) {
      if (current.me.tokens[color] === 0) continue;
      const after = applyToModel(current, { type: 'RETURN_GEMS', tokens: { [color]: 1 } });
      const value = evaluate(after, aware);
      if (!best || value > best.value) best = { color, after, value };
    }
    if (!best) break;
    returned[best.color] += 1;
    current = best.after;
  }
  return Object.fromEntries(
    TOKEN_COLORS.flatMap((c) => (returned[c] > 0 ? [[c, returned[c]]] : [])),
  );
}

/** The noble worth most; then the one an opponent is nearest to taking; then by id. */
export function chooseNoble(model: Model, choices: readonly Noble[]): Noble {
  const nearestRival = (noble: Noble) =>
    Math.min(
      ...model.opponents.map((seat) =>
        Object.entries(noble.requirement).reduce(
          (sum, [color, need]) =>
            sum + Math.max(0, need - seat.bonuses[color as keyof typeof seat.bonuses]),
          0,
        ),
      ),
    );
  const [best] = [...choices].sort(
    (a, b) => b.points - a.points || nearestRival(a) - nearestRival(b) || a.id.localeCompare(b.id),
  );
  if (!best) throw new Error('No noble to choose');
  return best;
}

/**
 * A whole turn of the seat's own: the action, then what the rules make follow from it. The
 * real RETURN_GEMS and CHOOSE_NOBLE steps use the same two choices, so a plan matches what
 * the bot then does.
 */
function applyOwnTurn(model: Model, action: SplendorAction, aware: boolean): Model {
  let after = applyToModel(model, action);
  const excess = getExcessTokens(after.me.tokens);
  if (excess > 0) {
    after = applyToModel(after, {
      type: 'RETURN_GEMS',
      tokens: chooseReturn(after, excess, aware),
    });
  }
  const eligible = getEligibleNobles(after.nobles, after.me.bonuses);
  if (eligible.length > 0) {
    after = applyToModel(after, {
      type: 'CHOOSE_NOBLE',
      nobleId: chooseNoble(after, eligible).id,
    });
  }
  return after;
}

/** The best the seat can add to its position over its next `depth` turns, left alone. */
function lookAhead(model: Model, depth: number): number {
  if (depth === 0 || model.me.points >= model.targetScore) return 0;
  const base = evaluate(model, true);
  const steps = listLegalActions(getPlannedMoves(model), model.me.tokens)
    .map((action) => {
      const after = applyOwnTurn(model, action, true);
      return { after, gain: evaluate(after, true) - base };
    })
    .sort((a, b) => b.gain - a.gain)
    .slice(0, PLAN_WIDTH);
  return Math.max(
    0,
    ...steps.map((step) => step.gain + FORESIGHT * lookAhead(step.after, depth - 1)),
  );
}

/** Reserving a card nobody has seen is a gamble the planning bots do not take. */
function getOptions(view: SplendorView, model: Model): SplendorAction[] {
  const all = listLegalActions(view.legal, model.me.tokens);
  const known = all.filter((action) => action.type !== 'RESERVE_FROM_DECK');
  const options = known.length > 0 ? known : all;
  if (options.length === 0) throw new Error('Splendor bot asked to move with no legal move');
  return options;
}

/** normal: the move that leaves the seat's own position best after this one turn. */
function chooseGreedily(view: SplendorView, model: Model, random: SeededRandom): SplendorAction {
  return pickBest(
    getOptions(view, model),
    (action) => evaluate(applyOwnTurn(model, action, false), false),
    random,
  );
}

/**
 * hard: plans a few of its own turns, and counts what a move leaves the strongest opponent
 * with, so it takes or reserves what they are about to buy. On its last turn only the final
 * standing matters: most points, then fewest cards.
 */
function choosePlanned(view: SplendorView, model: Model, random: SeededRandom): SplendorAction {
  const options = getOptions(view, model);
  if (view.finalRound) {
    return pickBest(
      options,
      (action) => {
        const { me } = applyOwnTurn(model, action, true);
        return me.points * 1000 - me.cardCount;
      },
      random,
    );
  }

  const rivalry = model.opponents.length === 1 ? RIVALRY_DUEL : RIVALRY_TABLE;
  const candidates = options
    .map((action) => {
      const after = applyOwnTurn(model, action, true);
      const rival = Math.max(
        ...after.opponents.map((seat) => evaluate(asSeenBy(after, seat), true)),
      );
      return { action, after, now: evaluate(after, true) - rivalry * rival };
    })
    .sort((a, b) => b.now - a.now)
    .slice(0, ROOT_WIDTH);

  return pickBest(
    candidates,
    (candidate) => candidate.now + FORESIGHT * lookAhead(candidate.after, PLAN_DEPTH - 1),
    random,
  ).action;
}

function pickTokens(
  tokens: TokenCounts,
  count: number,
  random: SeededRandom,
): Partial<TokenCounts> {
  const held = TOKEN_COLORS.flatMap((color) => Array<TokenColor>(tokens[color]).fill(color));
  const returned: Partial<TokenCounts> = {};
  for (const color of random.shuffle(held).slice(0, count)) {
    returned[color] = (returned[color] ?? 0) + 1;
  }
  return returned;
}

/**
 * easy: any legal move, read straight off `legal`. It buys whenever it can, so its games
 * still end. This is also what the platform falls back on, so it must handle every step.
 */
function chooseAtRandom(
  view: SplendorView,
  playerId: string,
  random: SeededRandom,
): SplendorAction {
  const { legal } = view;
  const tokens = view.players[playerId]?.tokens ?? emptyTokens();
  if (legal.mustReturn > 0) {
    return { type: 'RETURN_GEMS', tokens: pickTokens(tokens, legal.mustReturn, random) };
  }

  const options = listLegalActions(legal, tokens);
  const ofType = (...types: SplendorAction['type'][]) =>
    options.filter((action) => types.includes(action.type));
  const buys = ofType('BUY_CARD');
  const takes = ofType('TAKE_GEMS');
  const reserves = ofType('RESERVE_CARD', 'RESERVE_FROM_DECK');

  if (buys.length > 0) return random.pick(buys);
  if (reserves.length > 0 && (takes.length === 0 || random.next() < EASY_RESERVE_CHANCE)) {
    return random.pick(reserves);
  }
  if (options.length === 0) throw new Error('Splendor bot asked to move with no legal move');
  return random.pick(takes.length > 0 ? takes : options);
}

/**
 * - easy: a random legal move, buying when it can;
 * - normal: the move that looks best for itself right now;
 * - hard: plans several turns and watches what the others are about to take.
 */
export const SplendorBot: BotStrategy<SplendorView, SplendorAction> = {
  chooseAction({ view, playerId, level, random }: BotDecisionInput<SplendorView>) {
    if (level === 'easy') return chooseAtRandom(view, playerId, random);

    const aware = level === 'hard';
    const model = readView(view, playerId);
    if (view.legal.mustReturn > 0) {
      return { type: 'RETURN_GEMS', tokens: chooseReturn(model, view.legal.mustReturn, aware) };
    }
    if (view.legal.nobleChoices.length > 0) {
      const choices = model.nobles.filter((noble) => view.legal.nobleChoices.includes(noble.id));
      return { type: 'CHOOSE_NOBLE', nobleId: chooseNoble(model, choices).id };
    }
    return aware ? choosePlanned(view, model, random) : chooseGreedily(view, model, random);
  },
};
