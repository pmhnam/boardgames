import type { ParseConfigResult, ParseSettingsResult } from '@bgp/game-core';
import { MAX_PLAYERS, ROBBER_ROLL, SETUP_ROUNDS } from './config.js';
import {
  DEFAULT_BEGINNER_TILES,
  DEFAULT_HARBORS,
  DEFAULT_HEXES,
  DEFAULT_NUMBER_TOKENS,
  DEFAULT_TERRAIN_COUNTS,
  type HarborPlacement,
  type HarborType,
  type Tile,
} from './default-board.js';
import { DEVELOPMENT_CARD_TYPES, type DevelopmentCardType } from './development-cards.js';
import { HEX_SIDES, hexKey, hexNeighbour, hexSideEdge, isHexSide, type Hex } from './hex.js';
import {
  RESOURCES,
  TERRAINS,
  countResources,
  emptyResources,
  isResource,
  isTerrain,
  type ResourceCounts,
  type Terrain,
} from './resources.js';
import { buildTopology } from './topology.js';

/** The pieces each player starts with. */
export interface Pieces {
  roads: number;
  settlements: number;
  cities: number;
}

export interface Costs {
  road: ResourceCounts;
  settlement: ResourceCounts;
  city: ResourceCounts;
  developmentCard: ResourceCounts;
}

/** Everything about CATAN that can change without changing its rules. */
export interface CatanConfig {
  /** The hexes of the island. */
  hexes: Hex[];
  /** How many hexes of each terrain a random board is made of. */
  terrainCounts: Record<Terrain, number>;
  /** The number tokens a random board deals onto its producing hexes. */
  numberTokens: number[];
  /** The fixed board for a first game, one tile per hex, in the order of `hexes`. */
  beginnerTiles: Tile[];
  harbors: HarborPlacement[];
  /** Whether a random board keeps the 6s and 8s off neighbouring hexes. */
  keepRedNumbersApart: boolean;
  /** Resource cards of each kind in the supply. */
  resourcesPerType: number;
  developmentCards: Record<DevelopmentCardType, number>;
  pieces: Pieces;
  costs: Costs;
  victoryPointsToWin: number;
  /** The shortest road that can hold Longest Road. */
  longestRoadMinimum: number;
  /** The fewest played knights that can hold Largest Army. */
  largestArmyMinimum: number;
  /** A player holding more resource cards than this loses half of them to a 7. */
  discardLimit: number;
}

export const BOARD_SETUPS = ['random', 'beginner'] as const;
export type BoardSetup = (typeof BOARD_SETUPS)[number];

/** What a room's host chooses for a match. */
export interface CatanSettings {
  boardSetup: BoardSetup;
}

/** A harbor as a match plays it: the edge whose two corners trade through it. */
export interface Harbor {
  edge: string;
  type: HarborType;
}

/**
 * The config as one match plays it. This is what a match keeps in its state, so it is
 * unaffected by later config changes.
 */
export interface CatanSetup {
  hexes: Hex[];
  harbors: Harbor[];
  pieces: Pieces;
  costs: Costs;
  victoryPointsToWin: number;
  longestRoadMinimum: number;
  largestArmyMinimum: number;
  discardLimit: number;
}

const cost = (counts: Partial<ResourceCounts>): ResourceCounts => ({
  ...emptyResources(),
  ...counts,
});

export const DEFAULT_CATAN_CONFIG: CatanConfig = {
  hexes: DEFAULT_HEXES.map((hex) => ({ ...hex })),
  terrainCounts: { ...DEFAULT_TERRAIN_COUNTS },
  numberTokens: [...DEFAULT_NUMBER_TOKENS],
  beginnerTiles: DEFAULT_BEGINNER_TILES.map((tile) => ({ ...tile })),
  harbors: DEFAULT_HARBORS.map((harbor) => ({ ...harbor })),
  keepRedNumbersApart: true,
  resourcesPerType: 19,
  developmentCards: { knight: 14, victoryPoint: 5, roadBuilding: 2, yearOfPlenty: 2, monopoly: 2 },
  pieces: { roads: 15, settlements: 5, cities: 4 },
  costs: {
    road: cost({ brick: 1, wood: 1 }),
    settlement: cost({ brick: 1, wood: 1, wool: 1, grain: 1 }),
    city: cost({ grain: 2, ore: 3 }),
    developmentCard: cost({ wool: 1, grain: 1, ore: 1 }),
  },
  victoryPointsToWin: 10,
  longestRoadMinimum: 5,
  largestArmyMinimum: 3,
  discardLimit: 7,
};

export function resolveSetup(config: CatanConfig): CatanSetup {
  return {
    hexes: config.hexes.map((hex) => ({ ...hex })),
    harbors: config.harbors.map((harbor) => ({
      edge: hexSideEdge(harbor, harbor.side),
      type: harbor.type,
    })),
    pieces: { ...config.pieces },
    costs: {
      road: { ...config.costs.road },
      settlement: { ...config.costs.settlement },
      city: { ...config.costs.city },
      developmentCard: { ...config.costs.developmentCard },
    },
    victoryPointsToWin: config.victoryPointsToWin,
    longestRoadMinimum: config.longestRoadMinimum,
    largestArmyMinimum: config.largestArmyMinimum,
    discardLimit: config.discardLimit,
  };
}

/** No settings means a random board. */
export function parseSettings(
  raw: unknown,
  _config: CatanConfig,
): ParseSettingsResult<CatanSettings> {
  const defaults: CatanSettings = { boardSetup: 'random' };
  if (raw === undefined || raw === null) return { ok: true, settings: defaults };

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Settings must be an object.' };
  }
  const boardSetup = (raw as Record<string, unknown>).boardSetup ?? defaults.boardSetup;
  if (!BOARD_SETUPS.includes(boardSetup as BoardSetup)) {
    return { ok: false, message: `boardSetup must be one of: ${BOARD_SETUPS.join(', ')}.` };
  }
  return { ok: true, settings: { boardSetup: boardSetup as BoardSetup } };
}

const MAX_HEXES = 61;
const MAX_COORDINATE = 10;
const MAX_HARBORS = 30;
const MAX_CARDS = 50;
const MAX_PIECES = 50;
const MAX_COST_PER_RESOURCE = 10;
const MAX_DISCARD_LIMIT = 100;
const MIN_NUMBER = 2;
const MAX_NUMBER = 12;

/**
 * Corners the board needs for the opening: every settlement rules out itself and at most
 * three neighbours, so the last one placed still finds a free corner.
 */
const MIN_VERTICES = 4 * (SETUP_ROUNDS * MAX_PLAYERS - 1) + 1;

/** Thrown inside the parser and turned into a ParseConfigResult at its edge. */
class ConfigError extends Error {}

function fail(message: string): never {
  throw new ConfigError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInteger(value: unknown, what: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    fail(`${what} must be an integer from ${min} to ${max}.`);
  }
  return value as number;
}

function parseArray(value: unknown, what: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail(`${what} must be a list of ${min} to ${max} items.`);
  }
  return value;
}

function parseHexes(raw: unknown): Hex[] {
  const hexes = parseArray(raw, 'hexes', 1, MAX_HEXES).map((hex, index): Hex => {
    const at = `hexes[${index}]`;
    if (!isRecord(hex)) fail(`${at} must be an object.`);
    return {
      q: parseInteger(hex.q, `${at}.q`, -MAX_COORDINATE, MAX_COORDINATE),
      r: parseInteger(hex.r, `${at}.r`, -MAX_COORDINATE, MAX_COORDINATE),
    };
  });
  if (new Set(hexes.map(hexKey)).size !== hexes.length) fail('hexes contains a duplicate.');
  if (buildTopology(hexes).vertices.length < MIN_VERTICES) {
    fail(`hexes must give the board at least ${MIN_VERTICES} corners to settle.`);
  }
  return hexes;
}

function parseTerrainCounts(raw: unknown, hexCount: number): Record<Terrain, number> {
  if (!isRecord(raw)) fail('terrainCounts must be an object with a count for each terrain.');
  const counts = {} as Record<Terrain, number>;
  for (const terrain of TERRAINS) {
    counts[terrain] = parseInteger(raw[terrain], `terrainCounts.${terrain}`, 0, MAX_HEXES);
  }
  const total = TERRAINS.reduce((sum, terrain) => sum + counts[terrain], 0);
  if (total !== hexCount) fail(`terrainCounts must add up to the ${hexCount} hexes.`);
  if (counts.desert < 1) fail('terrainCounts.desert must be at least 1: the robber starts there.');
  return counts;
}

function parseNumber(value: unknown, what: string): number {
  const number = parseInteger(value, what, MIN_NUMBER, MAX_NUMBER);
  if (number === ROBBER_ROLL) fail(`${what} must not be ${ROBBER_ROLL}.`);
  return number;
}

function parseNumberTokens(raw: unknown, producingHexes: number): number[] {
  if (!Array.isArray(raw) || raw.length !== producingHexes) {
    fail(`numberTokens must be a list of ${producingHexes} numbers, one per producing hex.`);
  }
  return raw.map((value, index) => parseNumber(value, `numberTokens[${index}]`));
}

function sameItems(a: readonly (string | number)[], b: readonly (string | number)[]): boolean {
  const sorted = (items: readonly (string | number)[]) => [...items].map(String).sort().join(' ');
  return sorted(a) === sorted(b);
}

function parseBeginnerTiles(
  raw: unknown,
  terrainCounts: Record<Terrain, number>,
  numberTokens: readonly number[],
  hexCount: number,
): Tile[] {
  if (!Array.isArray(raw) || raw.length !== hexCount) {
    fail(`beginnerTiles must be a list of ${hexCount} tiles, one per hex.`);
  }
  const tiles = raw.map((tile, index): Tile => {
    const at = `beginnerTiles[${index}]`;
    if (!isRecord(tile)) fail(`${at} must be an object.`);
    const { terrain } = tile;
    if (!isTerrain(terrain)) fail(`${at}.terrain must be one of: ${TERRAINS.join(', ')}.`);
    if (terrain === 'desert') {
      if (tile.number !== null && tile.number !== undefined) {
        fail(`${at}.number must be null on a desert.`);
      }
      return { terrain, number: null };
    }
    return { terrain, number: parseNumber(tile.number, `${at}.number`) };
  });

  const terrains = TERRAINS.flatMap((terrain) =>
    Array.from({ length: terrainCounts[terrain] }, () => terrain),
  );
  if (
    !sameItems(
      tiles.map((tile) => tile.terrain),
      terrains,
    )
  ) {
    fail('beginnerTiles must use exactly the terrains in terrainCounts.');
  }
  const numbers = tiles.flatMap((tile) => (tile.number === null ? [] : [tile.number]));
  if (!sameItems(numbers, numberTokens)) {
    fail('beginnerTiles must use exactly the numbers in numberTokens.');
  }
  return tiles;
}

function parseHarbors(raw: unknown, hexes: readonly Hex[]): HarborPlacement[] {
  const onBoard = new Set(hexes.map(hexKey));
  const harbors = parseArray(raw, 'harbors', 0, MAX_HARBORS).map(
    (harbor, index): HarborPlacement => {
      const at = `harbors[${index}]`;
      if (!isRecord(harbor)) fail(`${at} must be an object.`);
      const hex = {
        q: parseInteger(harbor.q, `${at}.q`, -MAX_COORDINATE, MAX_COORDINATE),
        r: parseInteger(harbor.r, `${at}.r`, -MAX_COORDINATE, MAX_COORDINATE),
      };
      const { side, type } = harbor;
      if (!onBoard.has(hexKey(hex))) fail(`${at} must sit on a hex of the board.`);
      if (!isHexSide(side)) fail(`${at}.side must be one of: ${HEX_SIDES.join(', ')}.`);
      if (type !== 'any' && !isResource(type)) {
        fail(`${at}.type must be one of: any, ${RESOURCES.join(', ')}.`);
      }
      if (onBoard.has(hexKey(hexNeighbour(hex, side)))) {
        fail(`${at} must be on a side of its hex that faces the sea.`);
      }
      return { ...hex, side, type };
    },
  );
  const edges = harbors.map((harbor) => hexSideEdge(harbor, harbor.side));
  if (new Set(edges).size !== edges.length) fail('harbors puts two harbors on one edge.');
  return harbors;
}

function parseDevelopmentCards(raw: unknown): Record<DevelopmentCardType, number> {
  if (!isRecord(raw)) fail('developmentCards must be an object with a count for each card.');
  const counts = {} as Record<DevelopmentCardType, number>;
  for (const type of DEVELOPMENT_CARD_TYPES) {
    counts[type] = parseInteger(raw[type], `developmentCards.${type}`, 0, MAX_CARDS);
  }
  return counts;
}

function parsePieces(raw: unknown): Pieces {
  if (!isRecord(raw)) fail('pieces must be an object.');
  return {
    roads: parseInteger(raw.roads, 'pieces.roads', SETUP_ROUNDS, MAX_PIECES),
    settlements: parseInteger(raw.settlements, 'pieces.settlements', SETUP_ROUNDS, MAX_PIECES),
    cities: parseInteger(raw.cities, 'pieces.cities', 0, MAX_PIECES),
  };
}

function parseCost(raw: unknown, what: string, resourcesPerType: number): ResourceCounts {
  if (!isRecord(raw)) fail(`${what} must be an object with a count for each resource.`);
  const counts = emptyResources();
  const most = Math.min(MAX_COST_PER_RESOURCE, resourcesPerType);
  for (const resource of RESOURCES) {
    counts[resource] = parseInteger(raw[resource], `${what}.${resource}`, 0, most);
  }
  if (countResources(counts) === 0) fail(`${what} must ask for at least one resource.`);
  return counts;
}

function parseCosts(raw: unknown, resourcesPerType: number): Costs {
  if (!isRecord(raw)) fail('costs must be an object.');
  return {
    road: parseCost(raw.road, 'costs.road', resourcesPerType),
    settlement: parseCost(raw.settlement, 'costs.settlement', resourcesPerType),
    city: parseCost(raw.city, 'costs.city', resourcesPerType),
    developmentCard: parseCost(raw.developmentCard, 'costs.developmentCard', resourcesPerType),
  };
}

/**
 * Validates a config from an untrusted source and returns a clean copy holding only known
 * fields. Anything accepted here must be playable to the end by the engine.
 */
export function parseConfig(raw: unknown): ParseConfigResult<CatanConfig> {
  try {
    if (!isRecord(raw)) fail('Config must be an object.');
    const hexes = parseHexes(raw.hexes);
    const terrainCounts = parseTerrainCounts(raw.terrainCounts, hexes.length);
    const numberTokens = parseNumberTokens(raw.numberTokens, hexes.length - terrainCounts.desert);
    const beginnerTiles = parseBeginnerTiles(
      raw.beginnerTiles,
      terrainCounts,
      numberTokens,
      hexes.length,
    );
    const harbors = parseHarbors(raw.harbors, hexes);
    if (typeof raw.keepRedNumbersApart !== 'boolean') {
      fail('keepRedNumbersApart must be true or false.');
    }
    const resourcesPerType = parseInteger(raw.resourcesPerType, 'resourcesPerType', 1, MAX_CARDS);
    const pieces = parsePieces(raw.pieces);

    // The opening alone is worth this much, and buildings alone must be able to win.
    const openingPoints = SETUP_ROUNDS;
    const buildingPoints = pieces.settlements + 2 * pieces.cities;
    const victoryPointsToWin = parseInteger(
      raw.victoryPointsToWin,
      'victoryPointsToWin',
      openingPoints + 1,
      buildingPoints,
    );

    return {
      ok: true,
      config: {
        hexes,
        terrainCounts,
        numberTokens,
        beginnerTiles,
        harbors,
        keepRedNumbersApart: raw.keepRedNumbersApart,
        resourcesPerType,
        developmentCards: parseDevelopmentCards(raw.developmentCards),
        pieces,
        costs: parseCosts(raw.costs, resourcesPerType),
        victoryPointsToWin,
        longestRoadMinimum: parseInteger(
          raw.longestRoadMinimum,
          'longestRoadMinimum',
          1,
          MAX_PIECES,
        ),
        largestArmyMinimum: parseInteger(
          raw.largestArmyMinimum,
          'largestArmyMinimum',
          1,
          MAX_CARDS,
        ),
        discardLimit: parseInteger(raw.discardLimit, 'discardLimit', 1, MAX_DISCARD_LIMIT),
      },
    };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, message: error.message };
    throw error;
  }
}
