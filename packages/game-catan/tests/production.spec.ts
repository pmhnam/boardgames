import { describe, expect, it } from 'vitest';
import { deepFreeze } from '@bgp/game-core/testing';
import { CatanRuleCodes } from '../src/domain/errors.js';
import { getProduction } from '../src/rules/production.rules.js';
import {
  active,
  apply,
  build,
  cards,
  corner,
  countAll,
  expectRejected,
  other,
  player,
  rigDice,
  started,
} from './fixtures/states.js';

// On the test island the hex at (1, 0) is a forest that produces on a 3.
const FOREST = { q: 1, r: 0 };
const FOREST_ROLL = 3;

describe('what a roll produces', () => {
  it('gives a settlement one card and a city two', () => {
    const state = started();
    const me = active(state);
    const settled = build(state, me, corner(FOREST.q, FOREST.r, 0));
    expect(getProduction(settled, FOREST_ROLL)).toEqual({ [me]: cards({ wood: 1 }) });

    const grown = build(state, me, corner(FOREST.q, FOREST.r, 0), 'city');
    expect(getProduction(grown, FOREST_ROLL)).toEqual({ [me]: cards({ wood: 2 }) });
  });

  it('pays every building around the hex, whoever owns it', () => {
    const state = started();
    const me = active(state);
    const you = other(state);
    const built = build(
      build(build(state, me, corner(1, 0, 0)), me, corner(1, 0, 2), 'city'),
      you,
      corner(1, 0, 4),
    );
    expect(getProduction(built, FOREST_ROLL)).toEqual({
      [me]: cards({ wood: 3 }),
      [you]: cards({ wood: 1 }),
    });
  });

  it('adds up every hex that shares the number', () => {
    const state = started();
    const me = active(state);
    // Fields (4) at (0, 1) and pasture (4) at (1, -1) both produce on a 4.
    const built = build(build(state, me, corner(0, 1, 3)), me, corner(1, -1, 0));
    expect(getProduction(built, 4)).toEqual({ [me]: cards({ wheat: 1, wool: 1 }) });
  });

  it('gives nothing from the hex the robber stands on', () => {
    const state = started();
    const built = build(state, active(state), corner(1, 0, 0));
    expect(getProduction({ ...built, robber: '1,0' }, FOREST_ROLL)).toEqual({});
  });

  it('gives nothing for a number no hex has, or to a corner away from the hex', () => {
    const state = build(started(), active(started()), corner(-2, 2, 3));
    expect(getProduction(state, FOREST_ROLL)).toEqual({});
    expect(getProduction(state, 7)).toEqual({});
  });

  it('gives nobody a resource the supply cannot pay everyone their share of', () => {
    const state = started();
    const built = build(
      build(state, active(state), corner(1, 0, 0)),
      other(state),
      corner(1, 0, 3),
    );
    const short = { ...built, supply: { ...built.supply, wood: 1 } };
    expect(getProduction(short, FOREST_ROLL)).toEqual({});
  });

  it('still pays the other resources when one runs short', () => {
    const state = started();
    const me = active(state);
    const you = other(state);
    const built = build(
      build(build(state, me, corner(0, 1, 0)), you, corner(0, 1, 3)),
      me,
      corner(1, -1, 0),
    );
    const short = { ...built, supply: { ...built.supply, wheat: 1 } };
    expect(getProduction(short, 4)).toEqual({ [me]: cards({ wool: 1 }) });
  });

  it('gives a player who is the only one owed whatever is left', () => {
    const state = started();
    const me = active(state);
    const built = build(state, me, corner(1, 0, 0), 'city');
    const short = { ...built, supply: { ...built.supply, wood: 1 } };
    expect(getProduction(short, FOREST_ROLL)).toEqual({ [me]: cards({ wood: 1 }) });
    expect(getProduction({ ...built, supply: { ...built.supply, wood: 0 } }, FOREST_ROLL)).toEqual(
      {},
    );
  });
});

describe('rolling the dice', () => {
  it('rolls two dice from the seed and hands out what they produce', () => {
    const state = started();
    const me = active(state);
    const ready = rigDice(build(state, me, corner(1, 0, 0)), FOREST_ROLL);

    const next = apply(ready, { type: 'ROLL_DICE' });

    expect((next.turn.roll?.[0] ?? 0) + (next.turn.roll?.[1] ?? 0)).toBe(FOREST_ROLL);
    expect(next.turn.step).toBe('MAIN');
    expect(player(next, me).resources).toEqual(cards({ wood: 1 }));
    expect(next.supply.wood).toBe(18);
    expect(countAll(next)).toEqual(countAll(state));
    expect(next.random.draws).toBe(ready.random.draws + 1);
  });

  it('rolls the same dice again from the same state', () => {
    const state = started();
    expect(apply(state, { type: 'ROLL_DICE' })).toEqual(apply(state, { type: 'ROLL_DICE' }));
  });

  it('can roll every total from 2 to 12, each die showing 1 to 6', () => {
    const state = started();
    for (let total = 2; total <= 12; total += 1) {
      const roll = apply(rigDice(state, total), { type: 'ROLL_DICE' }).turn.roll;
      expect(roll?.[0]).toBeGreaterThanOrEqual(1);
      expect(roll?.[0]).toBeLessThanOrEqual(6);
      expect(roll?.[1]).toBeGreaterThanOrEqual(1);
      expect(roll?.[1]).toBeLessThanOrEqual(6);
      expect((roll?.[0] ?? 0) + (roll?.[1] ?? 0)).toBe(total);
    }
  });

  it('produces nothing on a 7', () => {
    const state = started();
    const built = build(state, active(state), corner(1, 0, 0));
    const next = apply(rigDice(built, 7), { type: 'ROLL_DICE' });
    expect(next.supply).toEqual(state.supply);
  });

  it('is refused a second time, and from anyone else', () => {
    const state = started();
    const rolled = apply(rigDice(state, 5), { type: 'ROLL_DICE' });
    expectRejected(rolled, { type: 'ROLL_DICE' }, CatanRuleCodes.WrongStep);
    expectRejected(state, { type: 'ROLL_DICE' }, CatanRuleCodes.NotYourTurn, other(state));
  });

  it('is refused once the game is over', () => {
    const state = deepFreeze({ ...started(), phase: 'FINISHED' as const });
    expectRejected(state, { type: 'ROLL_DICE' }, CatanRuleCodes.GameNotPlaying);
  });
});
