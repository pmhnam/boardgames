import { describe, expect, it } from 'vitest';
import type { HexSide } from '../src/domain/hex.js';
import { getTopology } from '../src/rules/placement.rules.js';
import { getSupplyRates } from '../src/rules/trade.rules.js';
import { getRouteLength } from '../src/scoring/longest-route.js';
import { active, build, corner, inMain, others, pave, side } from './fixtures/states.js';

// Some answers are kept with the part of the state they were worked out from, since the table
// is shown to every seat after every action. These hold that what is kept is never stale.

const RING: HexSide[] = ['NE', 'E', 'SE', 'SW', 'W', 'NW'];
const run = (q: number, r: number, count: number) =>
  RING.slice(0, count).map((hexSide) => side(q, r, hexSide));

describe('what the rules remember', () => {
  const state = inMain();
  const me = active(state);
  const you = others(state)[0] as string;

  it('gives a route the same length however often it is asked for', () => {
    const road = pave(state, me, ...run(0, 0, 4));
    expect(getRouteLength(road, me)).toBe(4);
    expect(getRouteLength(road, me)).toBe(4);
    expect(getRouteLength(road, you)).toBe(0);
  });

  it('measures a route again once a building goes up among the very same roads', () => {
    const road = pave(state, me, ...run(0, 0, 4));
    expect(getRouteLength(road, me)).toBe(4);
    // Somebody else settles between the second and the third road: the roads did not change.
    const cut = build(road, you, corner(0, 0, 2));
    expect(cut.roads).toBe(road.roads);
    expect(getRouteLength(cut, me)).toBe(2);
    // And the state from before still reads as it did.
    expect(getRouteLength(road, me)).toBe(4);
  });

  it('measures a route again once another road is laid', () => {
    const road = pave(state, me, ...run(0, 0, 4));
    expect(getRouteLength(road, me)).toBe(4);
    expect(getRouteLength(pave(road, me, side(0, 0, 'W')), me)).toBe(5);
  });

  it('works port rates out again once a building goes up', () => {
    const before = getSupplyRates(state, me);
    // The wool port is on the upper-right side of the top-middle hex.
    const settled = build(state, me, corner(0, -2, 0));
    expect(getSupplyRates(settled, me)).not.toEqual(before);
    expect(getSupplyRates(state, me)).toEqual(before);
  });

  it('hands out port rates that are the caller’s own', () => {
    const rates = getSupplyRates(state, me);
    rates.brick = 1;
    expect(getSupplyRates(state, me).brick).not.toBe(1);
  });

  it('finds the same topology for a match every time', () => {
    expect(getTopology(state)).toBe(getTopology(pave(state, me, side(0, 0, 'NE'))));
  });
});
