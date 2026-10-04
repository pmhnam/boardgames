import { describe, expect, it } from 'vitest';
import { DEFAULT_HEXES } from '../src/domain/default-board.js';
import { CatanRuleCodes } from '../src/domain/errors.js';
import { buildTopology } from '../src/domain/topology.js';
import { getPiecesLeft } from '../src/rules/placement.rules.js';
import {
  active,
  apply,
  build,
  cards,
  corner,
  countAll,
  expectRejected,
  hold,
  inMain,
  other,
  pave,
  player,
  side,
  started,
} from './fixtures/states.js';

const topology = buildTopology(DEFAULT_HEXES);

const ROAD = { brick: 1, wood: 1 };
const SETTLEMENT = { brick: 1, wood: 1, wool: 1, wheat: 1 };
const CITY = { wheat: 2, ore: 3 };

/** The active player with a settlement on top of the centre hex and cards to spend. */
function settled(hand: Parameters<typeof hold>[2] = {}) {
  const state = inMain();
  return hold(build(state, active(state), corner(0, 0, 0)), active(state), hand);
}

describe('building a road', () => {
  it('costs a brick and a wood, which go back to the supply', () => {
    const state = settled({ brick: 2, wood: 1, ore: 1 });
    const next = apply(state, { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') });

    expect(next.roads[side(0, 0, 'NE')]).toBe(active(state));
    expect(player(next, active(state)).resources).toEqual(cards({ brick: 1, ore: 1 }));
    expect(countAll(next)).toEqual(countAll(state));
  });

  it('continues from one of the player own roads', () => {
    const state = pave(settled(ROAD), active(inMain()), side(0, 0, 'NE'));
    const next = apply(state, { type: 'BUILD_ROAD', edge: side(0, 0, 'E') });
    expect(next.roads[side(0, 0, 'E')]).toBe(active(state));
  });

  it('is refused away from the player own roads and buildings', () => {
    const state = settled(ROAD);
    expectRejected(
      state,
      { type: 'BUILD_ROAD', edge: side(0, 0, 'SE') },
      CatanRuleCodes.NotConnected,
    );
  });

  it('does not continue through a corner somebody else has built on', () => {
    const base = pave(settled(ROAD), active(inMain()), side(0, 0, 'NE'));
    const state = build(base, other(base), corner(0, 0, 1));
    expectRejected(
      state,
      { type: 'BUILD_ROAD', edge: side(0, 0, 'E') },
      CatanRuleCodes.NotConnected,
    );
  });

  it('does not start from somebody else building or road', () => {
    const base = inMain();
    const state = hold(
      pave(build(base, other(base), corner(0, 0, 0)), other(base), side(0, 0, 'NE')),
      active(base),
      ROAD,
    );
    expectRejected(
      state,
      { type: 'BUILD_ROAD', edge: side(0, 0, 'NW') },
      CatanRuleCodes.NotConnected,
    );
    expectRejected(
      state,
      { type: 'BUILD_ROAD', edge: side(0, 0, 'E') },
      CatanRuleCodes.NotConnected,
    );
  });

  it('is refused on an edge that has a road, or is not on the board', () => {
    const state = pave(settled(ROAD), other(inMain()), side(0, 0, 'NE'));
    expectRejected(
      state,
      { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') },
      CatanRuleCodes.EdgeOccupied,
    );
    expectRejected(state, { type: 'BUILD_ROAD', edge: 'nowhere' }, CatanRuleCodes.InvalidEdge);
  });

  it('is refused without the cards, the pieces, or the roll', () => {
    expectRejected(
      settled({ brick: 1 }),
      { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') },
      CatanRuleCodes.CannotAfford,
    );

    const all = settled(ROAD);
    const paved = pave(all, active(all), ...topology.edges.slice(0, 15));
    const free = topology.edges.slice(15).find((edge) => edge !== side(0, 0, 'NE')) as string;
    expectRejected(paved, { type: 'BUILD_ROAD', edge: free }, CatanRuleCodes.NoPiecesLeft);

    const state = started();
    const waiting = hold(build(state, active(state), corner(0, 0, 0)), active(state), ROAD);
    expectRejected(
      waiting,
      { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') },
      CatanRuleCodes.WrongStep,
    );
  });

  it('is refused from a player who is not on turn', () => {
    const state = settled(ROAD);
    expectRejected(
      state,
      { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') },
      CatanRuleCodes.NotYourTurn,
      other(state),
    );
  });
});

describe('building a settlement', () => {
  /** Two roads from the settlement, so the far corner is two edges away. */
  const withRoads = (hand: Parameters<typeof hold>[2]) => {
    const state = settled(hand);
    return pave(state, active(state), side(0, 0, 'NE'), side(0, 0, 'E'));
  };

  it('costs a brick, a wood, a wool and a wheat, on a corner the player road reaches', () => {
    const state = withRoads({ ...SETTLEMENT, ore: 2 });
    const vertex = corner(0, 0, 2);

    const next = apply(state, { type: 'BUILD_SETTLEMENT', vertex });

    expect(next.buildings[vertex]).toEqual({ playerId: active(state), kind: 'settlement' });
    expect(player(next, active(state)).resources).toEqual(cards({ ore: 2 }));
    expect(countAll(next)).toEqual(countAll(state));
  });

  it('is refused on a corner the player has no road to', () => {
    const state = withRoads(SETTLEMENT);
    expectRejected(
      state,
      { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 4) },
      CatanRuleCodes.NotConnected,
    );
  });

  it('is refused next to any building, on a taken corner, or off the board', () => {
    const state = withRoads(SETTLEMENT);
    expectRejected(
      state,
      { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 1) },
      CatanRuleCodes.TooClose,
    );
    expectRejected(
      state,
      { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 0) },
      CatanRuleCodes.VertexOccupied,
    );
    expectRejected(
      state,
      { type: 'BUILD_SETTLEMENT', vertex: '9,9,S' },
      CatanRuleCodes.InvalidVertex,
    );

    const crowded = build(state, other(state), corner(0, 0, 3));
    expectRejected(
      crowded,
      { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 2) },
      CatanRuleCodes.TooClose,
    );
  });

  it('is refused without the cards, the pieces, or the roll', () => {
    expectRejected(
      withRoads({ brick: 1, wood: 1, wool: 1 }),
      { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 2) },
      CatanRuleCodes.CannotAfford,
    );

    let full = withRoads(SETTLEMENT);
    for (const [q, r] of [
      [2, -2],
      [-2, 2],
      [2, 0],
      [-2, 0],
    ] as const) {
      full = build(full, active(full), corner(q, r, 0));
    }
    expect(getPiecesLeft(full, active(full)).settlements).toBe(0);
    expectRejected(
      full,
      { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 2) },
      CatanRuleCodes.NoPiecesLeft,
    );

    const state = started();
    expectRejected(
      hold(state, active(state), SETTLEMENT),
      { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 2) },
      CatanRuleCodes.WrongStep,
    );
  });
});

describe('building a city', () => {
  it('costs two wheat and three ore and replaces a settlement, which comes back', () => {
    const state = settled({ ...CITY, wool: 1 });
    const me = active(state);
    const vertex = corner(0, 0, 0);
    expect(getPiecesLeft(state, me)).toEqual({ roads: 15, settlements: 4, cities: 4 });

    const next = apply(state, { type: 'BUILD_CITY', vertex });

    expect(next.buildings[vertex]).toEqual({ playerId: me, kind: 'city' });
    expect(player(next, me).resources).toEqual(cards({ wool: 1 }));
    expect(getPiecesLeft(next, me)).toEqual({ roads: 15, settlements: 5, cities: 3 });
    expect(countAll(next)).toEqual(countAll(state));
  });

  it('is refused anywhere but on one of the player own settlements', () => {
    const base = settled(CITY);
    const state = build(base, other(base), corner(0, 0, 3));
    expectRejected(
      state,
      { type: 'BUILD_CITY', vertex: corner(0, 0, 3) },
      CatanRuleCodes.NotYourSettlement,
    );
    expectRejected(
      state,
      { type: 'BUILD_CITY', vertex: corner(0, 0, 2) },
      CatanRuleCodes.NotYourSettlement,
    );
    expectRejected(state, { type: 'BUILD_CITY', vertex: 'nowhere' }, CatanRuleCodes.InvalidVertex);

    const grown = build(base, active(base), corner(0, 0, 0), 'city');
    expectRejected(
      grown,
      { type: 'BUILD_CITY', vertex: corner(0, 0, 0) },
      CatanRuleCodes.NotYourSettlement,
    );
  });

  it('is refused without the cards or the pieces', () => {
    expectRejected(
      settled({ wheat: 2, ore: 2 }),
      { type: 'BUILD_CITY', vertex: corner(0, 0, 0) },
      CatanRuleCodes.CannotAfford,
    );

    let full = settled(CITY);
    for (const [q, r] of [
      [2, -2],
      [-2, 2],
      [2, 0],
      [-2, 0],
    ] as const) {
      full = build(full, active(full), corner(q, r, 0), 'city');
    }
    expectRejected(
      full,
      { type: 'BUILD_CITY', vertex: corner(0, 0, 0) },
      CatanRuleCodes.NoPiecesLeft,
    );
  });
});
