import { deepFreeze } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { SplendorAction } from '../src/domain/actions.js';
import { SplendorRuleCodes } from '../src/domain/errors.js';
import type { SplendorState } from '../src/domain/state.js';
import { getEligibleNobles } from '../src/rules/noble.rules.js';
import {
  active,
  apply,
  cardIds,
  engine,
  expectRejected,
  gameConfig,
  gems,
  newGame,
  other,
  tokens,
  withPlayer,
  withPurchased,
} from './fixtures/states.js';

const MACHIAVELLI = 'noble-machiavelli'; // 4 white, 4 blue
const ANNE = 'noble-anne-of-brittany'; // 3 white, 3 blue, 3 green
const HENRY = 'noble-henry-viii'; // 4 red, 4 black

/** A game with exactly these nobles on the table. */
function withNobles(state: SplendorState, nobleIds: string[], targetScore = 15): SplendorState {
  return deepFreeze({
    ...state,
    nobles: nobleIds,
    config: {
      ...state.config,
      targetScore,
      nobles: gameConfig.nobles.filter((noble) => nobleIds.includes(noble.id)),
    },
  });
}

// Tier 1 cards worth no points, so every point in these tests comes from a noble.
const zeroPoint = (bonus: string, count: number) =>
  cardIds(bonus, 1)
    .filter((id) => !id.endsWith('-02'))
    .slice(0, count);

const WHITE_BLUE = [...zeroPoint('white', 4), ...zeroPoint('blue', 4)];
const WHITE_BLUE_GREEN = [...WHITE_BLUE, ...zeroPoint('green', 3)];
const TAKE: SplendorAction = { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] };

describe('getEligibleNobles', () => {
  it('needs every required bonus', () => {
    const nobles = gameConfig.nobles;
    const ids = (bonuses: ReturnType<typeof gems>) =>
      getEligibleNobles(nobles, bonuses).map((noble) => noble.id);

    expect(ids(gems({ white: 4, blue: 3 }))).toEqual([]);
    expect(ids(gems({ white: 4, blue: 4 }))).toEqual([MACHIAVELLI]);
    expect(ids(gems({ white: 4, blue: 4, green: 3 }))).toEqual([MACHIAVELLI, ANNE]);
  });
});

describe('a noble visit', () => {
  it('happens by itself at the end of the turn when one noble is eligible', () => {
    const base = withNobles(newGame(), [MACHIAVELLI, HENRY]);
    const playerId = active(base);
    const state = withPurchased(base, playerId, WHITE_BLUE);

    const next = apply(state, TAKE);

    expect(next.players[playerId]?.nobles).toEqual([MACHIAVELLI]);
    expect(next.nobles).toEqual([HENRY]);
    expect(engine.getPublicView(next, { type: 'spectator' }).players[playerId]?.points).toBe(3);
    expect(active(next)).toBe(other(state));
  });

  it('counts bonuses, never tokens', () => {
    const base = withNobles(newGame(), [MACHIAVELLI]);
    const playerId = active(base);
    const state = withPlayer(base, playerId, { tokens: tokens({ white: 4, blue: 3 }) });

    const next = apply(state, { type: 'TAKE_GEMS', colors: ['blue', 'green', 'red'] });

    expect(next.players[playerId]?.nobles).toEqual([]);
    expect(next.nobles).toEqual([MACHIAVELLI]);
  });

  it('asks the player to choose when two nobles are eligible', () => {
    const base = withNobles(newGame(), [MACHIAVELLI, ANNE, HENRY]);
    const playerId = active(base);
    const state = withPurchased(base, playerId, WHITE_BLUE_GREEN);

    const waiting = apply(state, TAKE);

    expect(waiting.turn).toMatchObject({ activePlayerId: playerId, step: 'CHOOSE_NOBLE' });
    expect(waiting.players[playerId]?.nobles).toEqual([]);
    expect(engine.getPublicView(waiting, { type: 'player', playerId }).legal.nobleChoices).toEqual([
      MACHIAVELLI,
      ANNE,
    ]);

    expectRejected(waiting, TAKE, SplendorRuleCodes.WrongStep);
    expectRejected(
      waiting,
      { type: 'CHOOSE_NOBLE', nobleId: HENRY },
      SplendorRuleCodes.NobleNotEligible,
    );
    expectRejected(
      waiting,
      { type: 'CHOOSE_NOBLE', nobleId: 'no-such-noble' },
      SplendorRuleCodes.NobleNotEligible,
    );
  });

  it('gives one noble per turn; the other comes on the next turn', () => {
    const base = withNobles(newGame(), [MACHIAVELLI, ANNE]);
    const playerId = active(base);
    const state = withPurchased(base, playerId, WHITE_BLUE_GREEN);

    const chosen = apply(apply(state, TAKE), { type: 'CHOOSE_NOBLE', nobleId: ANNE });
    expect(chosen.players[playerId]?.nobles).toEqual([ANNE]);
    expect(chosen.nobles).toEqual([MACHIAVELLI]);
    expect(active(chosen)).toBe(other(state));

    // The opponent moves, then any action at all brings the second noble.
    const back = apply(chosen, { type: 'TAKE_GEMS', colors: ['red', 'black', 'green'] });
    const second = apply(back, { type: 'TAKE_GEMS', colors: ['red', 'black', 'green'] });
    expect(second.players[playerId]?.nobles).toEqual([ANNE, MACHIAVELLI]);
    expect(second.nobles).toEqual([]);
  });

  it('is refused outside its step', () => {
    const base = withNobles(newGame(), [MACHIAVELLI]);
    const state = withPurchased(base, active(base), WHITE_BLUE);
    expectRejected(
      state,
      { type: 'CHOOSE_NOBLE', nobleId: MACHIAVELLI },
      SplendorRuleCodes.WrongStep,
    );
  });

  it('follows the return of excess tokens within the same turn', () => {
    const base = withNobles(newGame(), [MACHIAVELLI, ANNE]);
    const playerId = active(base);
    const state = withPlayer(withPurchased(base, playerId, WHITE_BLUE_GREEN), playerId, {
      tokens: tokens({ red: 3, black: 3, green: 3 }),
    });

    const taken = apply(state, TAKE);
    expect(taken.turn.step).toBe('RETURN_GEMS');

    const returned = apply(taken, { type: 'RETURN_GEMS', tokens: { red: 2 } });
    expect(returned.turn).toMatchObject({ activePlayerId: playerId, step: 'CHOOSE_NOBLE' });

    const chosen = apply(returned, { type: 'CHOOSE_NOBLE', nobleId: MACHIAVELLI });
    expect(chosen.players[playerId]?.nobles).toEqual([MACHIAVELLI]);
    expect(active(chosen)).toBe(other(state));
  });

  it('can be what takes a player to the target', () => {
    const base = withNobles(newGame(), [MACHIAVELLI], 3);
    const first = base.turnOrder[0] as string;
    const state = withPurchased(base, first, WHITE_BLUE);

    const visited = apply(state, TAKE);
    expect(visited.finalRound).toBe(true);
    expect(visited.phase).toBe('PLAYING');

    const done = apply(visited, { type: 'TAKE_GEMS', colors: ['red', 'black', 'green'] });
    expect(done.phase).toBe('FINISHED');
    expect(done.winnerPlayerIds).toEqual([first]);
  });
});
