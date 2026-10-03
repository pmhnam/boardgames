import type { DevelopmentCard, Noble } from '../domain/cards.js';
import { DOUBLE_TAKE_MIN_PILE, MAX_RESERVED, TOKEN_LIMIT } from '../domain/config.js';
import { GEM_COLORS, emptyGems, type GemCounts, type TokenCounts } from '../domain/gems.js';
import { getTargets, type Model, type Seat } from './model.js';

const POINT_VALUE = 100;
/** Enough to outweigh anything else: reaching the target is what the game is about. */
const WIN_VALUE = 10_000;
/** A card that would reach the target is worth racing for, and worth denying. */
const WINNING_CARD_VALUE = 2_000;
/** A bonus is an engine early on and nearly spent once somebody is close to the target. */
const EARLY_BONUS_VALUE = 22;
const LATE_BONUS_VALUE = 6;
/** A bonus beyond anything on the table asks for is worth little. */
const SURPLUS_BONUS_FACTOR = 0.25;
/** How much of a noble's points count, by how many bonuses are still missing. */
const NOBLE_PROGRESS = [1, 0.6, 0.35, 0.2, 0.1];
/** What a turn of waiting costs: a card three turns away is worth 0.75³ of one in hand. */
const PATIENCE = 0.75;
const SECOND_TARGET_WEIGHT = 0.5;
const GEM_VALUE = 1;
const GOLD_VALUE = 3;
const RESERVED_CARD_COST = 12;
const FULL_RESERVE_COST = 18;
/** Turns lost, roughly, for each gem the bank cannot hand over right now. */
const SHORTAGE_TURNS = 2;
/** When someone else can buy a face-up card first, it may well be gone. */
const CONTESTED_FACTOR = 0.5;
const ABOUT_TO_GO_FACTOR = 0.3;

export const UNREACHABLE = 99;

/**
 * How many turns of taking gems the seat is away from affording a card: 0 if it can pay now,
 * UNREACHABLE if it needs more bonuses first.
 */
export function turnsToBuy(
  seat: Pick<Seat, 'tokens' | 'bonuses'>,
  card: Pick<DevelopmentCard, 'cost'>,
  bank: Readonly<TokenCounts>,
): number {
  let owedInTokens = 0;
  const needs = GEM_COLORS.map((color) => {
    const owed = Math.max(0, card.cost[color] - seat.bonuses[color]);
    owedInTokens += owed;
    return { color, need: Math.max(0, owed - seat.tokens[color]) };
  });
  if (owedInTokens > TOKEN_LIMIT) return UNREACHABLE;

  // Gold goes where it saves most: the colour the bank is shortest of, then the biggest need.
  for (let gold = seat.tokens.gold; gold > 0; gold -= 1) {
    const worst = needs.reduce((a, b) => {
      const shortA = a.need - bank[a.color];
      const shortB = b.need - bank[b.color];
      return shortB > shortA || (shortB === shortA && b.need > a.need) ? b : a;
    });
    if (worst.need === 0) break;
    worst.need -= 1;
  }

  const needed = needs.filter((entry) => entry.need > 0);
  const total = needed.reduce((sum, entry) => sum + entry.need, 0);
  if (total === 0) return 0;

  const [only] = needed;
  const largest =
    needed.length === 1 && only && bank[only.color] >= DOUBLE_TAKE_MIN_PILE
      ? Math.ceil(only.need / 2)
      : Math.max(...needed.map((entry) => entry.need));
  const shortage = needed.reduce(
    (sum, entry) => sum + Math.max(0, entry.need - bank[entry.color]),
    0,
  );
  return Math.max(Math.ceil(total / 3), largest) + SHORTAGE_TURNS * shortage;
}

function missingBonuses(noble: Noble, bonuses: Readonly<GemCounts>): number {
  return GEM_COLORS.reduce(
    (sum, color) => sum + Math.max(0, noble.requirement[color] - bonuses[color]),
    0,
  );
}

function nobleWeight(missing: number): number {
  return NOBLE_PROGRESS[missing] ?? 0;
}

/** The most of each colour anything in reach asks for: a card's cost or a noble's requirement. */
function getDemand(model: Model): GemCounts {
  const demand = emptyGems();
  for (const color of GEM_COLORS) {
    demand[color] = Math.max(
      0,
      ...getTargets(model).map((card) => card.cost[color]),
      ...model.nobles.map((noble) => noble.requirement[color]),
    );
  }
  return demand;
}

/**
 * How good the table looks from the model's own seat. `aware` also weighs what the opponents
 * are about to do; without it the seat plays as if alone.
 */
export function evaluate(model: Model, aware: boolean): number {
  const { me, opponents, bank } = model;
  if (me.points >= model.targetScore) return WIN_VALUE + me.points * POINT_VALUE - me.cardCount;

  const leader = Math.max(me.points, ...opponents.map((seat) => seat.points));
  const progress = Math.min(1, leader / model.targetScore);
  const bonusValue = EARLY_BONUS_VALUE + (LATE_BONUS_VALUE - EARLY_BONUS_VALUE) * progress;
  const demand = getDemand(model);
  const nextBonusValue = (color: keyof GemCounts) =>
    me.bonuses[color] < demand[color] ? bonusValue : bonusValue * SURPLUS_BONUS_FACTOR;

  let value = me.points * POINT_VALUE;

  for (const color of GEM_COLORS) {
    const useful = Math.min(me.bonuses[color], demand[color]);
    value += bonusValue * (useful + (me.bonuses[color] - useful) * SURPLUS_BONUS_FACTOR);
    value += me.tokens[color] * GEM_VALUE;
  }
  value += me.tokens.gold * GOLD_VALUE;
  value -= me.reservedCount * RESERVED_CARD_COST;
  if (me.reservedCount >= MAX_RESERVED) value -= FULL_RESERVE_COST;

  const nobleValues = model.nobles.map((noble) => {
    const missing = missingBonuses(noble, me.bonuses);
    const behind = aware && opponents.some((seat) => missingBonuses(noble, seat.bonuses) < missing);
    return { noble, missing, worth: noble.points * POINT_VALUE * (behind ? 0.5 : 1) };
  });
  for (const { missing, worth } of nobleValues) value += worth * nobleWeight(missing);

  const potentials = getTargets(model).map((card) => {
    const turns = turnsToBuy(me, card, bank);
    if (turns >= UNREACHABLE) return 0;

    let gain = card.points * POINT_VALUE + nextBonusValue(card.bonus);
    if (me.points + card.points >= model.targetScore) gain += WINNING_CARD_VALUE;
    for (const { noble, missing, worth } of nobleValues) {
      if (noble.requirement[card.bonus] > me.bonuses[card.bonus]) {
        gain += worth * (nobleWeight(missing - 1) - nobleWeight(missing));
      }
    }

    let potential = gain * PATIENCE ** (turns + 1);
    if (aware && !me.reserved.includes(card)) {
      const theirs = Math.min(...opponents.map((seat) => turnsToBuy(seat, card, bank)));
      if (theirs === 0) potential *= ABOUT_TO_GO_FACTOR;
      else if (theirs <= turns) potential *= CONTESTED_FACTOR;
    }
    return potential;
  });
  potentials.sort((a, b) => b - a);
  value += (potentials[0] ?? 0) + SECOND_TARGET_WEIGHT * (potentials[1] ?? 0);

  return value;
}
