import { describe, expect, it } from 'vitest';
import type { HexSide } from '../src/domain/hex.js';
import type { CatanState } from '../src/domain/state.js';
import { getRouteLength, resolveLongestRoute } from '../src/scoring/longest-route.js';
import {
  active,
  apply,
  build,
  corner,
  hold,
  inMain,
  others,
  pave,
  side,
} from './fixtures/states.js';

const RING: HexSide[] = ['NE', 'E', 'SE', 'SW', 'W', 'NW'];

/** The first `count` sides of a hex, clockwise from the top: one unbroken run of road. */
function run(q: number, r: number, count: number): string[] {
  return RING.slice(0, count).map((hexSide) => side(q, r, hexSide));
}

describe('the length of a road', () => {
  const state = inMain();
  const me = active(state);
  const you = others(state)[0] as string;

  it('is zero without roads and counts a straight run', () => {
    expect(getRouteLength(state, me)).toBe(0);
    expect(getRouteLength(pave(state, me, ...run(0, 0, 3)), me)).toBe(3);
  });

  it('counts only the longer arm of a fork', () => {
    // Three roads meeting at the upper-right corner of the centre hex.
    const forked = pave(state, me, side(0, 0, 'NE'), side(0, 0, 'E'), side(1, 0, 'NW'));
    expect(getRouteLength(forked, me)).toBe(2);
    expect(getRouteLength(pave(forked, me, side(0, 0, 'SE')), me)).toBe(3);
  });

  it('goes all the way round a loop, and on along a tail', () => {
    const loop = pave(state, me, ...run(0, 0, 6));
    expect(getRouteLength(loop, me)).toBe(6);
    expect(getRouteLength(pave(loop, me, side(1, 0, 'NW')), me)).toBe(7);
  });

  it('does not join two separate runs', () => {
    const split = pave(state, me, ...run(0, 0, 2), ...run(0, -2, 3));
    expect(getRouteLength(split, me)).toBe(3);
  });

  it('ignores the roads of other players', () => {
    const mixed = pave(pave(state, me, ...run(0, 0, 2)), you, side(0, 0, 'SE'));
    expect(getRouteLength(mixed, me)).toBe(2);
    expect(getRouteLength(mixed, you)).toBe(1);
  });

  it('is cut by somebody else building in the middle of it', () => {
    const road = pave(state, me, ...run(0, 0, 4));
    // The corner between the second and the third road.
    expect(getRouteLength(build(road, you, corner(0, 0, 2)), me)).toBe(2);
  });

  it('is not cut by a building at its end, nor by the player own', () => {
    const road = pave(state, me, ...run(0, 0, 4));
    expect(getRouteLength(build(road, you, corner(0, 0, 0)), me)).toBe(4);
    expect(getRouteLength(build(road, me, corner(0, 0, 2)), me)).toBe(4);
  });
});

describe('who holds Longest Route', () => {
  const base = inMain();
  const me = active(base);
  const [you, third] = others(base) as [string, string];
  const holding = (state: CatanState, holder: string | null) => ({
    ...state,
    longestRoutePlayerId: holder,
  });

  it('is nobody until a road is five long', () => {
    expect(resolveLongestRoute(pave(base, me, ...run(0, 0, 4)))).toBeNull();
    expect(resolveLongestRoute(pave(base, me, ...run(0, 0, 5)))).toBe(me);
  });

  it('stays with the holder when another player draws level', () => {
    const level = pave(pave(base, me, ...run(0, 0, 5)), you, ...run(0, -2, 5));
    expect(resolveLongestRoute(holding(level, me))).toBe(me);
    expect(resolveLongestRoute(holding(level, you))).toBe(you);
  });

  it('passes to a player whose road is strictly longer', () => {
    const ahead = pave(pave(base, me, ...run(0, 0, 5)), you, ...run(0, -2, 6));
    expect(resolveLongestRoute(holding(ahead, me))).toBe(you);
  });

  it('passes on when the holder road is cut below another', () => {
    const roads = pave(pave(base, me, ...run(0, 0, 5)), you, ...run(0, -2, 5));
    // A building on the bottom corner leaves runs of three and two.
    const cut = build(roads, third, corner(0, 0, 3));
    expect(getRouteLength(cut, me)).toBe(3);
    expect(resolveLongestRoute(holding(cut, me))).toBe(you);
  });

  it('goes to nobody when the holder is cut and the others are level, or too short', () => {
    const level = pave(
      pave(pave(base, me, ...run(0, 0, 5)), you, ...run(0, -2, 5)),
      third,
      ...run(0, 2, 5),
    );
    expect(resolveLongestRoute(holding(build(level, third, corner(0, 0, 3)), me))).toBeNull();

    const short = pave(pave(base, me, ...run(0, 0, 5)), you, ...run(0, -2, 4));
    expect(resolveLongestRoute(holding(build(short, you, corner(0, 0, 3)), me))).toBeNull();
  });

  it('is awarded by the road that makes five', () => {
    const state = hold(build(pave(base, me, ...run(0, 0, 4)), me, corner(0, 0, 0)), me, {
      brick: 1,
      wood: 1,
    });
    expect(state.longestRoutePlayerId).toBeNull();
    const next = apply(state, { type: 'BUILD_ROAD', edge: side(0, 0, 'W') });
    expect(next.longestRoutePlayerId).toBe(me);
  });

  it('is lost to a settlement built through the road', () => {
    // The other player holds it with five roads round the centre; the active player has a
    // road to the corner between the second and the third.
    const roads = holding(pave(base, you, ...run(0, 0, 5)), you);
    const state = hold(pave(roads, me, side(0, 1, 'NE')), me, {
      brick: 1,
      wood: 1,
      wool: 1,
      wheat: 1,
    });
    const next = apply(state, { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 2) });
    expect(getRouteLength(next, you)).toBe(3);
    expect(next.longestRoutePlayerId).toBeNull();
  });
});
