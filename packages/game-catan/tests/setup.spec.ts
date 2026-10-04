import { describe, expect, it } from 'vitest';
import { seats } from '@bgp/game-core/testing';
import { CatanRuleCodes } from '../src/domain/errors.js';
import { hexKey, hexNeighbours } from '../src/domain/hex.js';
import { TERRAINS, countResources } from '../src/domain/resources.js';
import type { CatanState } from '../src/domain/state.js';
import { getSetupPlayerId } from '../src/rules/turn.rules.js';
import {
  active,
  apply,
  corner,
  engine,
  expectRejected,
  gameConfig,
  newGame,
  other,
  player,
  side,
} from './fixtures/states.js';

function create(playerCount: number, seed = 'seed', boardSetup: 'random' | 'beginner' = 'random') {
  return engine.createInitialState({
    gameId: 'g',
    players: seats(playerCount),
    seed,
    config: gameConfig,
    settings: { boardSetup },
  });
}

describe('setting up', () => {
  it.each([2, 5])('refuses %i players', (count) => {
    expect(() => create(count)).toThrowError(
      expect.objectContaining({ code: 'INVALID_PLAYER_COUNT' }),
    );
  });

  it('starts with a full supply, a full deck and empty hands', () => {
    const state = create(4);
    expect(state.supply).toEqual({ brick: 19, wood: 19, wool: 19, grain: 19, ore: 19 });
    expect(state.developmentDeck).toHaveLength(25);
    expect(state.developmentDeck.filter((type) => type === 'knight')).toHaveLength(14);
    expect(state.developmentDeck.filter((type) => type === 'victoryPoint')).toHaveLength(5);
    for (const held of Object.values(state.players)) {
      expect(countResources(held.resources)).toBe(0);
      expect(held.developmentCards).toEqual([]);
    }
    expect(state.buildings).toEqual({});
    expect(state.roads).toEqual({});
  });

  it('lays the beginner board exactly as the config gives it', () => {
    const state = create(3, 'any', 'beginner');
    gameConfig.hexes.forEach((hex, index) => {
      expect(state.tiles[hexKey(hex)]).toEqual(gameConfig.beginnerTiles[index]);
    });
    expect(state.robber).toBe('0,0');
  });

  it('deals a random board from the terrain counts and the number tokens', () => {
    const state = create(3, 'shuffle');
    const tiles = Object.values(state.tiles);
    for (const terrain of TERRAINS) {
      expect(tiles.filter((tile) => tile.terrain === terrain)).toHaveLength(
        gameConfig.terrainCounts[terrain],
      );
    }
    const numbers = tiles.flatMap((tile) => (tile.number === null ? [] : [tile.number]));
    expect(numbers.sort((a, b) => a - b)).toEqual(gameConfig.numberTokens);
  });

  it('puts no number on the desert and starts the robber there', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const state = create(3, seed);
      const tile = state.tiles[state.robber];
      expect(tile).toEqual({ terrain: 'desert', number: null });
    }
  });

  it('keeps the 6s and 8s of a random board apart', () => {
    for (let index = 0; index < 40; index += 1) {
      const state = create(4, `red-${index}`);
      const isRed = (key: string) => [6, 8].includes(state.tiles[key]?.number ?? 0);
      for (const hex of state.config.hexes) {
        if (!isRed(hexKey(hex))) continue;
        expect(hexNeighbours(hex).map(hexKey).filter(isRed)).toEqual([]);
      }
    }
  });

  it('deals the same game from the same seed, and another from another', () => {
    expect(create(4, 'same')).toEqual(create(4, 'same'));
    expect(create(4, 'same').tiles).not.toEqual(create(4, 'other').tiles);
  });

  it('seats everyone, starting from a player the seed picks', () => {
    const starters = new Set<string>();
    for (let index = 0; index < 30; index += 1) {
      const state = create(4, `start-${index}`);
      expect([...state.turnOrder].sort()).toEqual(['p1', 'p2', 'p3', 'p4']);
      expect(state.turn.activePlayerId).toBe(state.turnOrder[0]);
      starters.add(state.turn.activePlayerId);
    }
    expect(starters.size).toBe(4);
  });
});

/** Plays the opening with the first legal settlement and road each time. */
function playOpening(state: CatanState, onTurn?: (state: CatanState) => void): CatanState {
  let current = state;
  while (current.turn.step === 'SETUP_SETTLEMENT' || current.turn.step === 'SETUP_ROAD') {
    onTurn?.(current);
    const view = engine.getPublicView(current, { type: 'player', playerId: active(current) });
    current =
      current.turn.step === 'SETUP_SETTLEMENT'
        ? apply(current, {
            type: 'PLACE_SETUP_SETTLEMENT',
            vertex: view.legal.settlementVertices[0] as string,
          })
        : apply(current, { type: 'PLACE_SETUP_ROAD', edge: view.legal.roadEdges[0] as string });
  }
  return current;
}

describe('the opening', () => {
  it('goes round the table and then back again', () => {
    const order = ['a', 'b', 'c'];
    const turns = [1, 2, 3, 4, 5, 6].map((turn) => getSetupPlayerId(order, turn));
    expect(turns).toEqual(['a', 'b', 'c', 'c', 'b', 'a']);
  });

  it('has each player place a settlement and then a road, twice', () => {
    const state = newGame({}, { players: 4 });
    const placers: string[] = [];
    const done = playOpening(state, (current) => {
      if (current.turn.step === 'SETUP_SETTLEMENT') placers.push(active(current));
    });

    const [a, b, c, d] = state.turnOrder;
    expect(placers).toEqual([a, b, c, d, d, c, b, a]);
    expect(Object.keys(done.buildings)).toHaveLength(8);
    expect(Object.keys(done.roads)).toHaveLength(8);
    expect(done.turn).toMatchObject({ number: 9, activePlayerId: a, step: 'ROLL', roll: null });
  });

  it('places a settlement on any free corner, for nothing', () => {
    const state = newGame();
    const vertex = corner(0, 0, 0);
    const next = apply(state, { type: 'PLACE_SETUP_SETTLEMENT', vertex });

    expect(next.buildings[vertex]).toEqual({ playerId: active(state), kind: 'settlement' });
    expect(next.turn).toMatchObject({ step: 'SETUP_ROAD', setupVertex: vertex });
    expect(next.turn.activePlayerId).toBe(active(state));
  });

  it('refuses a corner that is taken, next to a building, or not on the board', () => {
    const first = apply(newGame(), { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 0) });
    const state = apply(first, { type: 'PLACE_SETUP_ROAD', edge: side(0, 0, 'NE') });

    expectRejected(
      state,
      { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 0) },
      CatanRuleCodes.VertexOccupied,
    );
    expectRejected(
      state,
      { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 1) },
      CatanRuleCodes.TooClose,
    );
    expectRejected(
      state,
      { type: 'PLACE_SETUP_SETTLEMENT', vertex: '9,9,N' },
      CatanRuleCodes.InvalidVertex,
    );
  });

  it('only lets the road start at the settlement just placed', () => {
    const state = apply(newGame(), { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 0) });

    expectRejected(
      state,
      { type: 'PLACE_SETUP_ROAD', edge: side(0, 0, 'SE') },
      CatanRuleCodes.NotConnected,
    );
    expectRejected(
      state,
      { type: 'PLACE_SETUP_ROAD', edge: 'nowhere' },
      CatanRuleCodes.InvalidEdge,
    );
    const next = apply(state, { type: 'PLACE_SETUP_ROAD', edge: side(0, 0, 'NE') });
    expect(next.roads[side(0, 0, 'NE')]).toBe(active(state));
    expect(next.turn).toMatchObject({ step: 'SETUP_SETTLEMENT', setupVertex: null, number: 2 });
  });

  it('gives nothing for the first settlement', () => {
    const state = newGame();
    const next = apply(state, { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(1, 0, 0) });
    expect(countResources(player(next, active(state)).resources)).toBe(0);
  });

  it('gives one card per producing hex around the second settlement', () => {
    const opened = newGame();
    // The last round of a three-player opening starts on turn 4.
    const state = { ...opened, turn: { ...opened.turn, number: 4 } };
    // Where the desert, the forest (3) and the fields (4) meet on the beginner board.
    const next = apply(state, { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 2) });

    expect(player(next, active(state)).resources).toEqual({
      brick: 0,
      wood: 1,
      wool: 0,
      grain: 1,
      ore: 0,
    });
    expect(next.supply).toMatchObject({ wood: 18, grain: 18, brick: 19 });
  });

  it('refuses everything but placing', () => {
    const state = newGame();
    expectRejected(state, { type: 'ROLL_DICE' }, CatanRuleCodes.WrongStep);
    expectRejected(state, { type: 'END_TURN' }, CatanRuleCodes.WrongStep);
    expectRejected(
      state,
      { type: 'BUILD_SETTLEMENT', vertex: corner(0, 0, 0) },
      CatanRuleCodes.WrongStep,
    );
    expectRejected(
      state,
      { type: 'PLACE_SETUP_ROAD', edge: side(0, 0, 'NE') },
      CatanRuleCodes.WrongStep,
    );
  });

  it('refuses a player who is not placing', () => {
    const state = newGame();
    expectRejected(
      state,
      { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 0) },
      CatanRuleCodes.NotYourTurn,
      other(state),
    );
    expectRejected(
      state,
      { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 0) },
      CatanRuleCodes.NotYourTurn,
      'stranger',
    );
  });
});
