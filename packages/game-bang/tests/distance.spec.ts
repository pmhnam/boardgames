import { describe, expect, it } from 'vitest';
import { BangRuleCodes } from '../src/domain/errors.js';
import { getDistance, getWeaponRange } from '../src/rules/distance.rules.js';
import {
  expectRejected,
  legalFor,
  playAction,
  table,
  validate,
  viewFor,
  type SeatSpec,
} from './fixtures/states.js';

const five = (...patches: Array<[number, SeatSpec]>): SeatSpec[] => {
  const specs: SeatSpec[] = [{}, {}, {}, {}, {}];
  for (const [seat, patch] of patches) specs[seat - 1] = patch;
  return specs;
};

describe('distance', () => {
  it('is the seats between two players the short way round', () => {
    const state = table(five());
    expect(['p2', 'p3', 'p4', 'p5'].map((id) => getDistance(state, 'p1', id))).toEqual([
      1, 2, 2, 1,
    ]);
    expect(getDistance(state, 'p3', 'p1')).toBe(2);
  });

  it('does not count the eliminated', () => {
    const state = table(five([2, { alive: false }]));
    expect(getDistance(state, 'p1', 'p3')).toBe(1);
    expect(getDistance(state, 'p1', 'p4')).toBe(2);
  });

  it('is one more to a player with a mustang, for others only', () => {
    const state = table(five([2, { inPlay: ['mustang'] }]));
    expect(getDistance(state, 'p1', 'p2')).toBe(2);
    expect(getDistance(state, 'p3', 'p2')).toBe(2);
    expect(getDistance(state, 'p2', 'p1')).toBe(1);
  });

  it('is one less for a player with a scope, but never less than one', () => {
    const state = table(five([1, { inPlay: ['scope'] }]));
    expect(getDistance(state, 'p1', 'p3')).toBe(1);
    expect(getDistance(state, 'p1', 'p2')).toBe(1);
    expect(getDistance(state, 'p3', 'p1')).toBe(2);
  });

  it('is one more to Paul Regret and one less for Rose Doolan', () => {
    const state = table(five([2, { character: 'paulRegret' }], [5, { character: 'roseDoolan' }]));
    expect(getDistance(state, 'p1', 'p2')).toBe(2);
    expect(getDistance(state, 'p2', 'p1')).toBe(1);
    expect(getDistance(state, 'p5', 'p3')).toBe(1);
    expect(getDistance(state, 'p3', 'p5')).toBe(2);
    // A step further and a step nearer cancel out.
    expect(getDistance(state, 'p5', 'p2')).toBe(2);
  });

  it('is shown to each player from their own seat, and to nobody watching', () => {
    const state = table(five([2, { inPlay: ['mustang'] }], [4, { alive: false }]));
    const distances = (playerId: string) =>
      viewFor(state, playerId).players.map((seat) => seat.distance);
    expect(distances('p1')).toEqual([null, 2, 2, null, 1]);
    expect(distances('p4')).toEqual([null, null, null, null, null]);
  });
});

describe('a weapon', () => {
  it.each([
    [undefined, 1],
    ['volcanic', 1],
    ['schofield', 2],
    ['remington', 3],
    ['revCarabine', 4],
    ['winchester', 5],
  ] as const)('%s reaches %i', (weapon, range) => {
    const state = table(five([1, { inPlay: weapon ? [weapon] : [] }]));
    expect(getWeaponRange(state, 'p1')).toBe(range);
    expect(viewFor(state, 'p2').players[0]?.range).toBe(range);
  });

  it('decides who a BANG! can be played on', () => {
    const colt = table(five([1, { hand: ['bang'] }]));
    expect(legalFor(colt, 'p1').plays[0]?.targets).toEqual(['p2', 'p5']);
    expectRejected(colt, playAction(colt, 'p1', 'bang', 'p3'), BangRuleCodes.OutOfRange, 'p1');

    const rifle = table(five([1, { hand: ['bang'], inPlay: ['schofield'] }]));
    expect(legalFor(rifle, 'p1').plays[0]?.targets).toEqual(['p2', 'p3', 'p4', 'p5']);
    expect(validate(rifle, playAction(rifle, 'p1', 'bang', 'p3'), 'p1')).toEqual({ valid: true });
  });

  it('does nothing for a Panic!, which only a scope brings closer', () => {
    const rifle = table(
      five([1, { hand: ['panic'], inPlay: ['winchester'] }], [3, { hand: ['beer'] }]),
    );
    expectRejected(
      rifle,
      playAction(rifle, 'p1', 'panic', 'p3'),
      BangRuleCodes.InvalidTarget,
      'p1',
    );

    const near = table(
      five([1, { hand: ['panic'] }], [2, { hand: ['beer'] }], [3, { hand: ['beer'] }]),
    );
    expectRejected(near, playAction(near, 'p1', 'panic', 'p3'), BangRuleCodes.OutOfRange, 'p1');

    const scope = table(five([1, { hand: ['panic'], inPlay: ['scope'] }], [3, { hand: ['beer'] }]));
    expect(validate(scope, playAction(scope, 'p1', 'panic', 'p3'), 'p1')).toEqual({ valid: true });
  });

  it('leaves a BANG! unplayable when nobody is in reach', () => {
    const state = table([{ hand: ['bang'] }, { inPlay: ['mustang'] }, {}, { inPlay: ['mustang'] }]);
    expect(legalFor(state, 'p1').plays).toEqual([]);
    expectRejected(state, playAction(state, 'p1', 'bang', 'p2'), BangRuleCodes.OutOfRange, 'p1');
  });

  it('is aimed at somebody else who is still in the match', () => {
    const state = table(five([1, { hand: ['bang'] }], [2, { alive: false }]));
    for (const targetId of ['p1', 'p2', 'px', null]) {
      expectRejected(
        state,
        playAction(state, 'p1', 'bang', targetId),
        BangRuleCodes.InvalidTarget,
        'p1',
      );
    }
  });
});
