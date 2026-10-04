import { describe, expect, it } from 'vitest';
import { runMatch, seats } from '@bgp/game-core/testing';
import type { CatanConfig } from '../src/domain/game-config.js';
import { hexSideEdge } from '../src/domain/hex.js';
import { getPoints } from '../src/scoring/score.js';
import { scriptFullGame } from './fixtures/script.js';
import { engine, gameConfig } from './fixtures/states.js';

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
    expect(gameConfig.numberTokens).toHaveLength(18);
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
      'too few number tokens',
      configWith((c) => c.numberTokens.pop()),
      /numberTokens must be a list of 18 numbers/,
    ],
    ['a 7 token', configWith((c) => (c.numberTokens[0] = 7)), /numberTokens\[0\] must not be 7/],
    [
      'a token no dice can roll',
      configWith((c) => (c.numberTokens[0] = 13)),
      /numberTokens\[0\] must be an integer from 2 to 12/,
    ],
    [
      'a beginner board of the wrong size',
      configWith((c) => c.beginnerTiles.pop()),
      /beginnerTiles must be a list of 19 tiles/,
    ],
    [
      'a number on the beginner desert',
      configWith((c) => ((c.beginnerTiles[9] as { number: number | null }).number = 5)),
      /beginnerTiles\[9\]\.number must be null on a desert/,
    ],
    [
      'a beginner board with other terrains than the counts',
      configWith((c) => ((c.beginnerTiles[0] as { terrain: string }).terrain = 'forest')),
      /beginnerTiles must use exactly the terrains/,
    ],
    [
      'a beginner board with other numbers than the tokens',
      configWith((c) => ((c.beginnerTiles[0] as { number: number | null }).number = 9)),
      /beginnerTiles must use exactly the numbers/,
    ],
    [
      'a harbor off the board',
      configWith((c) => ((c.harbors[0] as { q: number }).q = 5)),
      /harbors\[0\] must sit on a hex of the board/,
    ],
    [
      'a harbor facing inland',
      configWith((c) => ((c.harbors[0] as { side: string }).side = 'SE')),
      /harbors\[0\] must be on a side of its hex that faces the sea/,
    ],
    [
      'a harbor on no side',
      configWith((c) => ((c.harbors[0] as { side: string }).side = 'N')),
      /harbors\[0\]\.side must be one of/,
    ],
    [
      'a harbor for no resource',
      configWith((c) => ((c.harbors[0] as { type: string }).type = 'gold')),
      /harbors\[0\]\.type must be one of/,
    ],
    [
      'two harbors on one edge',
      configWith((c) => (c.harbors[1] = { ...(c.harbors[0] as CatanConfig['harbors'][number]) })),
      /two harbors on one edge/,
    ],
    [
      'no answer on keeping red numbers apart',
      configWith((c) => Object.assign(c, { keepRedNumbersApart: 'yes' })),
      /keepRedNumbersApart must be true or false/,
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
      configWith((c) => (c.costs.road = { brick: 0, wood: 0, wool: 0, grain: 0, ore: 0 })),
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
      'no minimum for Longest Road',
      configWith((c) => (c.longestRoadMinimum = 0)),
      /longestRoadMinimum must be an integer from 1/,
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
  it('gives a random board when nothing is chosen', () => {
    expect(engine.parseSettings(undefined, gameConfig)).toEqual({
      ok: true,
      settings: { boardSetup: 'random' },
    });
    expect(engine.parseSettings({}, gameConfig)).toEqual({
      ok: true,
      settings: { boardSetup: 'random' },
    });
  });

  it('takes the beginner board, and drops anything else it is sent', () => {
    expect(engine.parseSettings({ boardSetup: 'beginner', extra: 1 }, gameConfig)).toEqual({
      ok: true,
      settings: { boardSetup: 'beginner' },
    });
  });

  it('refuses a setup it does not know, and anything that is not an object', () => {
    expect(engine.parseSettings({ boardSetup: 'islands' }, gameConfig).ok).toBe(false);
    expect(engine.parseSettings('beginner', gameConfig).ok).toBe(false);
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
      yearOfPlenty: 0,
      monopoly: 0,
    };
    config.pieces = { roads: 8, settlements: 4, cities: 2 };
    config.costs.road = { brick: 1, wood: 0, wool: 0, grain: 0, ore: 0 };
    config.harbors = [{ q: 0, r: -2, side: 'NW', type: 'ore' }];
    config.longestRoadMinimum = 3;
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
      harbors: [{ edge: hexSideEdge({ q: 0, r: -2 }, 'NW'), type: 'ore' }],
      longestRoadMinimum: 3,
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
      settings: { boardSetup: 'random' },
    });
    // The state holds its own copy of everything the rules read after setup.
    expect(state.config.costs).not.toBe(gameConfig.costs);
    expect(state.config.costs).toEqual(gameConfig.costs);
    expect(state.config.hexes).not.toBe(gameConfig.hexes);
  });
});
