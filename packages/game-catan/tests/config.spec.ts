import { describe, expect, it } from 'vitest';
import { runMatch, seats } from '@bgp/game-core/testing';
import type { CatanConfig } from '../src/domain/game-config.js';
import { hexSideEdge } from '../src/domain/hex.js';
import { getPoints } from '../src/scoring/score.js';
import { scriptFullGame } from './fixtures/script.js';
import { engine, gameConfig } from './fixtures/states.js';

type Seat = CatanConfig['fixedSetup']['seats'][number];
type Piece = CatanConfig['frame']['pieces'][number];

/** A deep copy of the default config with one part replaced. */
function configWith(patch: (config: CatanConfig) => void): CatanConfig {
  const config = JSON.parse(JSON.stringify(gameConfig)) as CatanConfig;
  patch(config);
  return config;
}

function expectRejected(raw: unknown, message: RegExp): void {
  const result = engine.parseConfig(raw);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.message).toMatch(message);
}

describe('the default config', () => {
  it('is accepted unchanged', () => {
    expect(engine.parseConfig(gameConfig)).toEqual({ ok: true, config: gameConfig });
  });

  it('survives being stored as JSON', () => {
    const stored = JSON.parse(JSON.stringify(gameConfig)) as unknown;
    expect(engine.parseConfig(stored)).toEqual({ ok: true, config: gameConfig });
  });

  it('is the base game: 19 hexes, 95 resource cards, 25 development cards', () => {
    expect(gameConfig.hexes).toHaveLength(19);
    expect(gameConfig.numberDiscs).toHaveLength(18);
    expect(gameConfig.frame.pieces.flatMap((piece) => piece.ports)).toHaveLength(9);
    expect(gameConfig.fixedSetup.seats).toHaveLength(4);
    expect(gameConfig.resourcesPerType * 5).toBe(95);
    expect(Object.values(gameConfig.developmentCards).reduce((sum, count) => sum + count)).toBe(25);
    expect(gameConfig.pieces).toEqual({ roads: 15, settlements: 5, cities: 4 });
    expect(gameConfig.victoryPointsToWin).toBe(10);
  });
});

describe('parseConfig', () => {
  it('drops fields it does not know', () => {
    const raw = configWith((config) => {
      Object.assign(config, { cheat: true });
      Object.assign(config.pieces, { ships: 15 });
      Object.assign(config.hexes[0] as object, { label: 'home' });
    });
    expect(engine.parseConfig(raw)).toEqual({ ok: true, config: gameConfig });
  });

  it.each<[string, unknown, RegExp]>([
    ['not an object', [], /must be an object/],
    ['no hexes', configWith((c) => (c.hexes = [])), /hexes must be a list/],
    [
      'a hex listed twice',
      configWith((c) => (c.hexes[1] = { ...(c.hexes[0] as CatanConfig['hexes'][number]) })),
      /hexes contains a duplicate/,
    ],
    [
      'a coordinate that is not a whole number',
      configWith((c) => ((c.hexes[0] as { q: number }).q = 0.5)),
      /hexes\[0\]\.q must be an integer/,
    ],
    [
      'a board too small for the opening',
      configWith(
        (c) =>
          (c.hexes = c.hexes.filter(
            (hex) => Math.abs(hex.q + hex.r) <= 1 && Math.abs(hex.q) <= 1 && Math.abs(hex.r) <= 1,
          )),
      ),
      /at least 29 corners/,
    ],
    [
      'terrains that do not cover the board',
      configWith((c) => (c.terrainCounts.forest = 3)),
      /terrainCounts must add up to the 19 hexes/,
    ],
    [
      'no desert for the robber',
      configWith((c) => {
        c.terrainCounts.desert = 0;
        c.terrainCounts.forest = 5;
      }),
      /terrainCounts\.desert must be at least 1/,
    ],
    [
      'too few number discs',
      configWith((c) => c.numberDiscs.pop()),
      /numberDiscs must be a list of 18 numbers/,
    ],
    ['a 7 disc', configWith((c) => (c.numberDiscs[0] = 7)), /numberDiscs\[0\] must not be 7/],
    [
      'a disc no dice can roll',
      configWith((c) => (c.numberDiscs[0] = 13)),
      /numberDiscs\[0\] must be an integer from 2 to 12/,
    ],
    [
      'a fixed island of the wrong size',
      configWith((c) => c.fixedSetup.tiles.pop()),
      /fixedSetup\.tiles must be a list of 19 tiles/,
    ],
    [
      'a number on the fixed desert',
      configWith((c) => ((c.fixedSetup.tiles[0] as { number: number | null }).number = 5)),
      /fixedSetup\.tiles\[0\]\.number must be null on a desert/,
    ],
    [
      'a fixed island with other terrains than the counts',
      configWith((c) => ((c.fixedSetup.tiles[1] as { terrain: string }).terrain = 'forest')),
      /fixedSetup\.tiles must use exactly the terrains/,
    ],
    [
      'a fixed island with other numbers than the discs',
      configWith((c) => ((c.fixedSetup.tiles[1] as { number: number | null }).number = 9)),
      /fixedSetup\.tiles must use exactly the numbers/,
    ],
    [
      'starting pieces for too few seats',
      configWith((c) => c.fixedSetup.seats.pop()),
      /fixedSetup\.seats must be a list of 4 seats/,
    ],
    [
      'a starting settlement off the board',
      configWith((c) => ((c.fixedSetup.seats[0] as Seat).first.settlement.q = 7)),
      /fixedSetup\.seats\[0\]\.first\.settlement must be a corner of the board/,
    ],
    [
      'a starting settlement on no corner',
      configWith((c) =>
        Object.assign((c.fixedSetup.seats[0] as Seat).first.settlement, { corner: 'E' }),
      ),
      /fixedSetup\.seats\[0\]\.first\.settlement\.corner must be N or S/,
    ],
    [
      'two starting settlements next to each other',
      configWith((c) => {
        // The bottom of the hex above-left of the one the first settlement sits on top of.
        (c.fixedSetup.seats[1] as Seat).first = {
          settlement: { q: -2, r: 1, corner: 'S' },
          road: { q: -2, r: 1, side: 'SW' },
        };
      }),
      /fixedSetup\.seats\[1\]\.first\.settlement must be two edges away/,
    ],
    [
      'a starting road away from its settlement',
      configWith((c) => ((c.fixedSetup.seats[0] as Seat).first.road.side = 'SE')),
      /fixedSetup\.seats\[0\]\.first\.road must be an edge of the board next to its settlement/,
    ],
    [
      'a frame that starts inland',
      configWith((c) => (c.frame.start.side = 'SE')),
      /frame\.start must be a side of a hex that faces the sea/,
    ],
    [
      'a frame that starts on no side',
      configWith((c) => Object.assign(c.frame.start, { side: 'N' })),
      /frame\.start\.side must be one of/,
    ],
    [
      'a frame too short for the coast',
      configWith((c) => c.frame.pieces.pop()),
      /frame\.pieces must cover the 30 edges of the coast, not 25/,
    ],
    [
      'a port beyond the end of its piece',
      configWith((c) => (((c.frame.pieces[0] as Piece).ports[0] as { at: number }).at = 5)),
      /frame\.pieces\[0\]\.ports\[0\]\.at must be an integer from 0 to 4/,
    ],
    [
      'a port for no resource',
      configWith((c) =>
        Object.assign((c.frame.pieces[0] as Piece).ports[0] as object, { type: 'gold' }),
      ),
      /frame\.pieces\[0\]\.ports\[0\]\.type must be one of/,
    ],
    [
      'two ports on one edge',
      configWith((c) => (((c.frame.pieces[0] as Piece).ports[1] as { at: number }).at = 0)),
      /frame\.pieces\[0\]\.ports puts two ports on one edge/,
    ],
    [
      'an empty supply',
      configWith((c) => (c.resourcesPerType = 0)),
      /resourcesPerType must be an integer from 1/,
    ],
    [
      'a negative number of cards',
      configWith((c) => (c.developmentCards.knight = -1)),
      /developmentCards\.knight must be an integer from 0/,
    ],
    [
      'too few settlements for the opening',
      configWith((c) => (c.pieces.settlements = 1)),
      /pieces\.settlements must be an integer from 2/,
    ],
    [
      'too few roads for the opening',
      configWith((c) => (c.pieces.roads = 1)),
      /pieces\.roads must be an integer from 2/,
    ],
    [
      'something that costs nothing',
      configWith((c) => (c.costs.road = { brick: 0, wood: 0, wool: 0, wheat: 0, ore: 0 })),
      /costs\.road must ask for at least one resource/,
    ],
    [
      'a cost the whole supply could not pay',
      configWith((c) => {
        c.resourcesPerType = 2;
        c.costs.city.ore = 3;
      }),
      /costs\.city\.ore must be an integer from 0 to 2/,
    ],
    [
      'a target the opening already reaches',
      configWith((c) => (c.victoryPointsToWin = 2)),
      /victoryPointsToWin must be an integer from 3 to 13/,
    ],
    [
      'a target buildings alone cannot reach',
      configWith((c) => (c.victoryPointsToWin = 14)),
      /victoryPointsToWin must be an integer from 3 to 13/,
    ],
    [
      'no minimum for Longest Route',
      configWith((c) => (c.longestRouteMinimum = 0)),
      /longestRouteMinimum must be an integer from 1/,
    ],
    [
      'no minimum for Largest Army',
      configWith((c) => (c.largestArmyMinimum = 0)),
      /largestArmyMinimum must be an integer from 1/,
    ],
    [
      'no hand limit',
      configWith((c) => (c.discardLimit = 0)),
      /discardLimit must be an integer from 1/,
    ],
  ])('refuses %s', (_name, raw, message) => {
    expectRejected(raw, message);
  });
});

describe('parseSettings', () => {
  it('gives the variable setup when nothing is chosen', () => {
    expect(engine.parseSettings(undefined, gameConfig)).toEqual({
      ok: true,
      settings: { boardSetup: 'variable' },
    });
    expect(engine.parseSettings({}, gameConfig)).toEqual({
      ok: true,
      settings: { boardSetup: 'variable' },
    });
  });

  it('takes the fixed setup, and drops anything else it is sent', () => {
    expect(engine.parseSettings({ boardSetup: 'fixed', extra: 1 }, gameConfig)).toEqual({
      ok: true,
      settings: { boardSetup: 'fixed' },
    });
  });

  it('refuses a setup it does not know, and anything that is not an object', () => {
    expect(engine.parseSettings({ boardSetup: 'islands' }, gameConfig).ok).toBe(false);
    expect(engine.parseSettings('fixed', gameConfig).ok).toBe(false);
    expect(engine.parseSettings([], gameConfig).ok).toBe(false);
  });
});

describe('a match from another config', () => {
  const custom = configWith((config) => {
    config.victoryPointsToWin = 5;
    config.resourcesPerType = 12;
    config.developmentCards = {
      knight: 4,
      victoryPoint: 1,
      roadBuilding: 1,
      invention: 0,
      monopoly: 0,
    };
    config.pieces = { roads: 8, settlements: 4, cities: 2 };
    config.costs.road = { brick: 1, wood: 0, wool: 0, wheat: 0, ore: 0 };
    // One piece all the way round, with a single ore port at its start.
    config.frame.pieces = [{ length: 30, ports: [{ at: 0, type: 'ore' }] }];
    config.numberDiscs = [...config.numberDiscs].reverse();
    config.fixedSetup.tiles = config.fixedSetup.tiles.map((tile) => ({ ...tile }));
    config.longestRouteMinimum = 3;
    config.discardLimit = 5;
  });

  it('is accepted', () => {
    expect(engine.parseConfig(custom)).toEqual({ ok: true, config: custom });
  });

  it('is set up and played by that config', () => {
    const actions = scriptFullGame('custom', 3, custom);
    const final = runMatch(engine, { seed: 'custom', players: seats(3), actions, config: custom });
    const [winnerId] = final.winnerPlayerIds;

    expect(final.config).toMatchObject({
      victoryPointsToWin: 5,
      pieces: { roads: 8, settlements: 4, cities: 2 },
      ports: [{ edge: hexSideEdge({ q: 0, r: -2 }, 'NW'), type: 'ore' }],
      longestRouteMinimum: 3,
      discardLimit: 5,
    });
    expect(final.phase).toBe('FINISHED');
    expect(getPoints(final, winnerId as string)).toBeGreaterThanOrEqual(5);
    expect(getPoints(final, winnerId as string)).toBeLessThan(10);
    for (const playerId of final.turnOrder) {
      const held = final.players[playerId];
      expect(
        Object.values(final.roads).filter((owner) => owner === playerId).length,
      ).toBeLessThanOrEqual(8);
      expect(held?.developmentCards.every((card) => card.type !== 'monopoly')).toBe(true);
    }
  });

  it('does not change a match that is already running', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: seats(3),
      seed: 'kept',
      config: gameConfig,
      settings: { boardSetup: 'variable' },
    });
    // The state holds its own copy of everything the rules read after setup.
    expect(state.config.costs).not.toBe(gameConfig.costs);
    expect(state.config.costs).toEqual(gameConfig.costs);
    expect(state.config.hexes).not.toBe(gameConfig.hexes);
  });
});
