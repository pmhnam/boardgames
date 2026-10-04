import { describe, expect, it } from 'vitest';
import { seats } from '@bgp/game-core/testing';
import { CatanRuleCodes } from '../src/domain/errors.js';
import { layFrame, type BoardSetup } from '../src/domain/game-config.js';
import { hexKey, hexNeighbours } from '../src/domain/hex.js';
import { TERRAINS, countResources, type Terrain } from '../src/domain/resources.js';
import type { CatanState } from '../src/domain/state.js';
import { layNumberDiscs } from '../src/random/setup-randomizer.js';
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

function create(playerCount: number, seed = 'seed', boardSetup: BoardSetup = 'variable') {
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
    expect(state.supply).toEqual({ brick: 19, wood: 19, wool: 19, wheat: 19, ore: 19 });
    expect(state.developmentDeck).toHaveLength(25);
    expect(state.developmentDeck.filter((type) => type === 'knight')).toHaveLength(14);
    expect(state.developmentDeck.filter((type) => type === 'victoryPoint')).toHaveLength(5);
    for (const held of Object.values(state.players)) {
      expect(countResources(held.resources)).toBe(0);
      expect(held.developmentCards).toEqual([]);
    }
    expect(state.buildings).toEqual({});
    expect(state.roads).toEqual({});
    expect(state.turn.step).toBe('SETUP_SETTLEMENT');
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

describe('the variable setup', () => {
  it('places the hexes at random, in the numbers the config gives', () => {
    const state = create(3, 'shuffle');
    const tiles = Object.values(state.tiles);
    for (const terrain of TERRAINS) {
      expect(tiles.filter((tile) => tile.terrain === terrain)).toHaveLength(
        gameConfig.terrainCounts[terrain],
      );
    }
    const numbers = tiles.flatMap((tile) => (tile.number === null ? [] : [tile.number]));
    expect(numbers.sort((a, b) => a - b)).toEqual(
      [...gameConfig.numberDiscs].sort((a, b) => a - b),
    );
  });

  it('lays the discs in letter order from a corner, skipping the desert', () => {
    // The rulebook's own example: the desert in the lower ring, the discs from the upper right.
    const terrains = gameConfig.hexes.map((hex): Terrain =>
      hex.q === 0 && hex.r === 1 ? 'desert' : 'fields',
    );
    const tiles = layNumberDiscs(gameConfig.hexes, terrains, gameConfig.numberDiscs, 0);
    const numbers = Object.fromEntries(
      gameConfig.hexes.map((hex, index) => [hexKey(hex), tiles[index]?.number]),
    );
    expect(numbers).toEqual({
      '0,-2': 6,
      '1,-2': 2,
      '2,-2': 5,
      '-1,-1': 3,
      '0,-1': 4,
      '1,-1': 9,
      '2,-1': 10,
      '-2,0': 8,
      '-1,0': 5,
      '0,0': 11,
      '1,0': 3,
      '2,0': 8,
      '-2,1': 10,
      '-1,1': 6,
      '0,1': null,
      '1,1': 4,
      '-2,2': 9,
      '-1,2': 12,
      '0,2': 11,
    });
  });

  it('starts the discs from different corners in different games', () => {
    const firsts = new Set<string>();
    for (let index = 0; index < 60; index += 1) {
      const state = create(3, `corner-${index}`);
      // The A disc is the first 5 along the spiral: on a corner unless the desert is there.
      const corner = ['2,-2', '0,-2', '-2,0', '-2,2', '0,2', '2,0'].find(
        (key) => state.tiles[key]?.number === 5 || state.tiles[key]?.terrain === 'desert',
      );
      if (corner) firsts.add(corner);
    }
    expect(firsts.size).toBeGreaterThan(3);
  });

  it('never puts two red numbers side by side', () => {
    for (let index = 0; index < 200; index += 1) {
      const state = create(4, `red-${index}`);
      const isRed = (key: string) => [6, 8].includes(state.tiles[key]?.number ?? 0);
      for (const hex of state.config.hexes) {
        if (!isRed(hexKey(hex))) continue;
        expect(hexNeighbours(hex).map(hexKey).filter(isRed)).toEqual([]);
      }
    }
  });

  it('puts no number on the desert and starts the robber there', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const state = create(3, seed);
      expect(state.tiles[state.robber]).toEqual({ terrain: 'desert', number: null });
    }
  });

  it('shuffles the frame, so the ports move from game to game', () => {
    const layouts = new Set<string>();
    for (let index = 0; index < 20; index += 1) {
      const { ports } = create(3, `frame-${index}`).config;
      expect(ports).toHaveLength(9);
      expect(ports.map((port) => port.type).sort()).toEqual(
        ['any', 'any', 'any', 'any', 'brick', 'wheat', 'ore', 'wood', 'wool'].sort(),
      );
      layouts.add(JSON.stringify(ports));
    }
    expect(layouts.size).toBeGreaterThan(10);
  });
});

describe('the fixed setup', () => {
  it('lays the island and the frame exactly as the config gives them', () => {
    const state = create(4, 'any', 'fixed');
    gameConfig.hexes.forEach((hex, index) => {
      expect(state.tiles[hexKey(hex)]).toEqual(gameConfig.fixedSetup.tiles[index]);
    });
    expect(state.tiles['0,-2']).toEqual({ terrain: 'desert', number: null });
    expect(state.robber).toBe('0,-2');
    expect(state.config.ports).toEqual(
      layFrame(gameConfig.hexes, gameConfig.frame.start, gameConfig.frame.pieces),
    );
    expect(create(4, 'other', 'fixed').tiles).toEqual(state.tiles);
  });

  it('starts every player with two settlements and two roads already placed', () => {
    const state = create(4, 'any', 'fixed');
    expect(Object.keys(state.buildings)).toHaveLength(8);
    expect(Object.keys(state.roads)).toHaveLength(8);
    for (const playerId of state.turnOrder) {
      const owned = Object.values(state.buildings).filter((piece) => piece.playerId === playerId);
      expect(owned).toEqual([
        { playerId, kind: 'settlement' },
        { playerId, kind: 'settlement' },
      ]);
      expect(Object.values(state.roads).filter((owner) => owner === playerId)).toHaveLength(2);
    }
    // The first seat's pieces, as the rulebook shows the red ones.
    expect(state.buildings[corner(-2, 2, 0)]?.playerId).toBe('p1');
    expect(state.buildings[corner(1, -1, 0)]?.playerId).toBe('p1');
    expect(state.roads[side(-2, 2, 'NW')]).toBe('p1');
    expect(state.roads[side(1, -1, 'NW')]).toBe('p1');
    // The third seat's first road runs straight up between the forest and the mountains.
    expect(state.roads[side(1, -1, 'E')]).toBe('p3');
  });

  it('gives each player the cards around their second settlement', () => {
    const state = create(4, 'any', 'fixed');
    const hand = (playerId: string) => player(state, playerId).resources;
    expect(hand('p1')).toEqual({ brick: 0, wood: 1, wool: 1, wheat: 1, ore: 0 });
    expect(hand('p2')).toEqual({ brick: 1, wood: 0, wool: 0, wheat: 1, ore: 1 });
    expect(hand('p3')).toEqual({ brick: 1, wood: 0, wool: 1, wheat: 1, ore: 0 });
    expect(hand('p4')).toEqual({ brick: 2, wood: 0, wool: 0, wheat: 1, ore: 0 });
    expect(state.supply).toEqual({ brick: 15, wood: 18, wool: 17, wheat: 15, ore: 18 });
  });

  it('leaves the fourth seat in the box in a three-player game', () => {
    const state = create(3, 'any', 'fixed');
    expect(Object.keys(state.buildings)).toHaveLength(6);
    expect(state.buildings[corner(0, 2, 0)]).toBeUndefined();
    expect(state.buildings[corner(-1, 1, 0)]).toBeUndefined();
  });

  it('skips the opening: the first player, picked by the seed, starts by rolling', () => {
    const starters = new Set<string>();
    for (let index = 0; index < 30; index += 1) {
      const state = create(4, `first-${index}`, 'fixed');
      expect(state.turn).toMatchObject({ step: 'ROLL', number: 1, roll: null });
      starters.add(state.turn.activePlayerId);
    }
    expect(starters.size).toBe(4);
    const state = create(3, 'roll', 'fixed');
    expect(apply(state, { type: 'ROLL_DICE' }).turn.roll).not.toBeNull();
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
    // Where the desert, the forest (3) and the fields (4) meet on the test island.
    const next = apply(state, { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 2) });

    expect(player(next, active(state)).resources).toEqual({
      brick: 0,
      wood: 1,
      wool: 0,
      wheat: 1,
      ore: 0,
    });
    expect(next.supply).toMatchObject({ wood: 18, wheat: 18, brick: 19 });
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
