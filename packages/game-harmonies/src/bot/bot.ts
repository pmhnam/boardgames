import type { BotDecisionInput, BotStrategy, SeededRandom } from '@bgp/game-core';
import type { HarmoniesAction } from '../domain/actions.js';
import { stackAt, type PlayerBoard } from '../domain/board.js';
import type { Hex } from '../domain/hex.js';
import type { TokenColor } from '../domain/tokens.js';
import { getLegalTokenCells } from '../rules/token-placement.rules.js';
import type { HarmoniesView } from '../visibility/public-view.js';
import { emptyCellValue, estimateTurnsLeft, evaluate } from './evaluate.js';
import { nextCube, readView, settle, withCard, withToken, type BotContext } from './model.js';

/** How many candidate boards the bot keeps after each token when planning a turn. */
const BEAM_WIDTH = { normal: 1, hard: 10 } as const;
/** How strongly the hard bot values keeping cells free when the board is the scarce resource. */
const EMPTY_CELL_WEIGHT = 2.5;

interface Plan {
  board: PlayerBoard;
  remaining: TokenColor[];
  /** The first placement of the plan: the only part that is acted on now. */
  first: { color: TokenColor; cell: Hex } | null;
  value: number;
}

function without(tokens: readonly TokenColor[], color: TokenColor): TokenColor[] {
  const rest = [...tokens];
  rest.splice(rest.indexOf(color), 1);
  return rest;
}

/**
 * Plans where a hand of tokens goes. After each token only the `width` most promising boards
 * are kept: width 1 is a greedy player, a wider beam finds placements that only pay off once
 * the whole hand is down.
 */
function planTokens(
  context: BotContext,
  board: PlayerBoard,
  tokens: readonly TokenColor[],
  width: number,
): Plan {
  let plans: Plan[] = [{ board, remaining: [...tokens], first: null, value: 0 }];

  for (let step = 0; step < tokens.length; step++) {
    const next: Plan[] = [];
    for (const plan of plans) {
      for (const color of new Set(plan.remaining)) {
        const remaining = without(plan.remaining, color);
        const cells = getLegalTokenCells(context, plan.board, color);
        if (cells.length === 0) {
          // Fits nowhere: it will be discarded at the end of the turn.
          next.push({ ...plan, remaining });
          continue;
        }
        for (const cell of cells) {
          next.push({
            board: settle(context, withToken(plan.board, color, cell)),
            remaining,
            first: plan.first ?? { color, cell },
            value: 0,
          });
        }
      }
    }
    for (const plan of next) plan.value = evaluate(context, plan.board);
    next.sort((a, b) => b.value - a.value);
    plans = next.slice(0, width);
  }

  const best = plans[0];
  if (!best) throw new Error('No plan for the tokens in hand');
  return best;
}

function chooseAtRandom(view: HarmoniesView, random: SeededRandom): HarmoniesAction {
  const { legal, centralSpaces, cardRiver } = view;

  for (const [cardId, cells] of Object.entries(legal.cubeCells)) {
    if (cells.length > 0) return { type: 'PLACE_CUBE', cardId, cell: random.pick(cells) };
  }
  if (legal.canTakeTokens) {
    const options = centralSpaces.flatMap((space, index) => (space.length > 0 ? [index] : []));
    return { type: 'TAKE_TOKENS', spaceIndex: random.pick(options) };
  }
  for (const [color, cells] of Object.entries(legal.tokenCells)) {
    if (cells.length > 0) {
      return { type: 'PLACE_TOKEN', color: color as TokenColor, cell: random.pick(cells) };
    }
  }
  if (legal.canTakeCard && random.next() < 0.7) {
    return { type: 'TAKE_CARD', cardId: random.pick(cardRiver).id };
  }
  return { type: 'END_TURN' };
}

/** The best the bot can do with the tokens on offer (or already in hand), from this board. */
function bestTokenPlan(
  context: BotContext,
  board: PlayerBoard,
  view: HarmoniesView,
  width: number,
): { plan: Plan; spaceIndex: number | null } | null {
  if (view.turn.tokensTaken) {
    return view.turn.hand.length > 0
      ? { plan: planTokens(context, board, view.turn.hand, width), spaceIndex: null }
      : null;
  }
  let best: { plan: Plan; spaceIndex: number } | null = null;
  for (const [spaceIndex, space] of view.centralSpaces.entries()) {
    if (space.length === 0) continue;
    const plan = planTokens(context, board, space, width);
    if (!best || plan.value > best.plan.value) best = { plan, spaceIndex };
  }
  return best;
}

/** The card on offer that the board is closest to serving. */
function chooseCard(context: BotContext, board: PlayerBoard, view: HarmoniesView): string | null {
  let bestCardId: string | null = null;
  let bestValue = -Infinity;
  for (const card of view.cardRiver) {
    const value = evaluate(context, withCard(board, card.id));
    if (value > bestValue) {
      bestCardId = card.id;
      bestValue = value;
    }
  }
  return bestCardId;
}

/** What only the hard bot thinks about: running out of room, and where an animal costs least. */
function sharpen(
  context: BotContext,
  board: PlayerBoard,
  view: HarmoniesView,
  playerId: string,
): BotContext {
  const countEmpty = (stacks: PlayerBoard['stacks']): number =>
    context.boardCells.filter((cell) => stackAt({ stacks }, cell).length === 0).length;

  const sharpened: BotContext = {
    ...context,
    emptyCellValue: emptyCellValue({
      emptyCells: countEmpty(board.stacks),
      turnsLeft: estimateTurnsLeft({
        pouchCount: view.pouchCount,
        playerCount: view.turnOrder.length,
        opponentEmptyCells: view.turnOrder
          .filter((otherId) => otherId !== playerId)
          .map((otherId) => countEmpty(view.boards[otherId]?.stacks ?? {})),
        finalRound: view.finalRound,
      }),
      weight: EMPTY_CELL_WEIGHT,
    }),
  };
  sharpened.cubeChooser = (candidate) => evaluate({ ...sharpened, cubeChooser: null }, candidate);
  return sharpened;
}

function chooseByValue(view: HarmoniesView, playerId: string, level: 'normal' | 'hard') {
  const read = readView(view, playerId);
  const { board } = read;
  const context = level === 'hard' ? sharpen(read.context, board, view, playerId) : read.context;
  const width = BEAM_WIDTH[level];

  // 1. An animal that can be placed is always placed: it only ever adds points.
  const cube = nextCube(context, board);
  if (cube) return { type: 'PLACE_CUBE', ...cube } satisfies HarmoniesAction;

  // 2. Decide on a card before the tokens, so the tokens are planned around it.
  if (view.legal.canTakeCard) {
    const cardId = chooseCard(context, board, view);
    if (cardId) return { type: 'TAKE_CARD', cardId } satisfies HarmoniesAction;
  }

  // 3. Take the tokens that can be put to the best use, then place them one action at a time.
  //    The plan is recomputed, identically, on every call.
  const best = bestTokenPlan(context, board, view, width);
  if (best?.spaceIndex != null) {
    return { type: 'TAKE_TOKENS', spaceIndex: best.spaceIndex } satisfies HarmoniesAction;
  }
  if (best?.plan.first) {
    return { type: 'PLACE_TOKEN', ...best.plan.first } satisfies HarmoniesAction;
  }

  return { type: 'END_TURN' } satisfies HarmoniesAction;
}

/**
 * - easy: any legal action;
 * - normal: the placement that looks best right now, one token at a time;
 * - hard: plans the whole hand before placing the first token, stacks rather than spreads when
 *   the board is going to fill up, and puts each animal where it blocks the least.
 */
export const HarmoniesBot: BotStrategy<HarmoniesView, HarmoniesAction> = {
  chooseAction({ view, playerId, level, random }: BotDecisionInput<HarmoniesView>) {
    return level === 'easy' ? chooseAtRandom(view, random) : chooseByValue(view, playerId, level);
  },
};
