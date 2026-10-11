import type { GameValidationResult, ParseConfigResult, ParseSettingsResult } from '@bgp/game-core';
import { listCoast, type HexSideRef } from './coast.js';
import { BASE_MAX_PLAYERS, MAX_PLAYERS, ROBBER_ROLL, SETUP_ROUNDS } from './config.js';
import {
  DEFAULT_FIXED_SETUP,
  DEFAULT_FRAME,
  DEFAULT_HEXES,
  DEFAULT_NUMBER_DISCS,
  DEFAULT_TERRAIN_COUNTS,
  EXTENSION_FRAME,
  EXTENSION_HEXES,
  EXTENSION_NUMBER_DISCS,
  EXTENSION_TERRAIN_COUNTS,
  type FixedSetup,
  type Frame,
  type FramePiece,
  type FramePort,
  type HexCornerRef,
  type PortType,
  type StartingPieces,
  type StartingPlacement,
  type Tile,
} from './default-board.js';
import { DEVELOPMENT_CARD_TYPES, type DevelopmentCardType } from './development-cards.js';
import { CatanRuleCodes, VALID, invalid } from './errors.js';
import { HEX_SIDES, hexCorner, hexKey, hexSideEdge, isHexSide, type Hex } from './hex.js';
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
import { buildTopology, endsOf, neighboursOf } from './topology.js';

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

/** The island and the cards that one size of table plays with. */
export interface TableConfig {
  /** The hexes of the island. */
  hexes: Hex[];
  /** How many hexes of each terrain the variable setup deals. */
  terrainCounts: Record<Terrain, number>;
  /**
   * The number discs in the order of the letters on their backs. The variable setup lays them
   * in that order from a corner of the island, counterclockwise and inwards, skipping deserts.
   */
  numberDiscs: number[];
  /** The sea frame and the ports on it. */
  frame: Frame;
  /** Resource cards of each kind in the supply. */
  resourcesPerType: number;
  developmentCards: Record<DevelopmentCardType, number>;
}

/**
 * Everything about CATAN that can change without changing its rules. The table at the top
 * level is the base game's, for three and four players.
 */
export interface CatanConfig extends TableConfig {
  /** The board and the starting pieces for a first game of the base game. */
  fixedSetup: FixedSetup;
  /** What five and six players play with instead: the 5–6 player extension. */
  extension: TableConfig;
  pieces: Pieces;
  costs: Costs;
  victoryPointsToWin: number;
  /** The shortest route that can hold Longest Route. */
  longestRouteMinimum: number;
  /** The fewest played knights that can hold Largest Army. */
  largestArmyMinimum: number;
  /** A player holding more resource cards than this loses half of them to a 7. */
  discardLimit: number;
}

/** The variable setup deals the island afresh; the fixed one is the rulebook's first game. */
export const BOARD_SETUPS = ['variable', 'fixed'] as const;
export type BoardSetup = (typeof BOARD_SETUPS)[number];

/** What a room's host chooses for a match. */
export interface CatanSettings {
  boardSetup: BoardSetup;
}

/** A port as a match plays it: the edge whose two corners trade through it. */
export interface Port {
  edge: string;
  type: PortType;
}

/**
 * The config as one match plays it. This is what a match keeps in its state, so it is
 * unaffected by later config changes.
 */
export interface CatanSetup {
  hexes: Hex[];
  ports: Port[];
  pieces: Pieces;
  costs: Costs;
  victoryPointsToWin: number;
  longestRouteMinimum: number;
  largestArmyMinimum: number;
  discardLimit: number;
}

const cost = (counts: Partial<ResourceCounts>): ResourceCounts => ({
  ...emptyResources(),
  ...counts,
});

const copyPlacement = (placement: StartingPlacement): StartingPlacement => ({
  settlement: { ...placement.settlement },
  road: { ...placement.road },
});

const copyFrame = (frame: Frame): Frame => ({
  start: { ...frame.start },
  pieces: frame.pieces.map((piece) => ({
    length: piece.length,
    ports: piece.ports.map((port) => ({ ...port })),
  })),
});

export const DEFAULT_CATAN_CONFIG: CatanConfig = {
  hexes: DEFAULT_HEXES.map((hex) => ({ ...hex })),
  terrainCounts: { ...DEFAULT_TERRAIN_COUNTS },
  numberDiscs: [...DEFAULT_NUMBER_DISCS],
  fixedSetup: {
    tiles: DEFAULT_FIXED_SETUP.tiles.map((tile) => ({ ...tile })),
    seats: DEFAULT_FIXED_SETUP.seats.map((seat) => ({
      first: copyPlacement(seat.first),
      second: copyPlacement(seat.second),
    })),
  },
  frame: copyFrame(DEFAULT_FRAME),
  resourcesPerType: 19,
  developmentCards: { knight: 14, victoryPoint: 5, roadBuilding: 2, invention: 2, monopoly: 2 },
  // The base game's cards with the extension's: five more of each resource, six knights and
  // one more of each progress card.
  extension: {
    hexes: EXTENSION_HEXES.map((hex) => ({ ...hex })),
    terrainCounts: { ...EXTENSION_TERRAIN_COUNTS },
    numberDiscs: [...EXTENSION_NUMBER_DISCS],
    frame: copyFrame(EXTENSION_FRAME),
    resourcesPerType: 24,
    developmentCards: { knight: 20, victoryPoint: 5, roadBuilding: 3, invention: 3, monopoly: 3 },
  },
  pieces: { roads: 15, settlements: 5, cities: 4 },
  costs: {
    road: cost({ brick: 1, wood: 1 }),
    settlement: cost({ brick: 1, wood: 1, wool: 1, wheat: 1 }),
    city: cost({ wheat: 2, ore: 3 }),
    developmentCard: cost({ wool: 1, wheat: 1, ore: 1 }),
  },
  victoryPointsToWin: 10,
  longestRouteMinimum: 5,
  largestArmyMinimum: 3,
  discardLimit: 7,
};

/** Where the ports end up once the frame pieces are laid round the coast in the given order. */
export function layFrame(
  hexes: readonly Hex[],
  start: HexSideRef,
  pieces: readonly FramePiece[],
): Port[] {
  const coast = listCoast(hexes, start);
  if (!coast) throw new Error('The coast is not a single ring');
  const ports: Port[] = [];
  let offset = 0;
  for (const piece of pieces) {
    for (const port of piece.ports) {
      const edge = coast[offset + port.at];
      if (edge === undefined) throw new Error('The frame is longer than the coast');
      ports.push({ edge, type: port.type });
    }
    offset += piece.length;
  }
  return ports;
}

/** What a table of that many plays with: the base game, or the extension past four players. */
export function getTable(config: CatanConfig, playerCount: number): TableConfig {
  return playerCount > BASE_MAX_PLAYERS ? config.extension : config;
}

/**
 * What a match keeps of the config: the island of its own table, and the ports its own frame
 * was laid with.
 */
export function resolveSetup(
  config: CatanConfig,
  hexes: readonly Hex[],
  ports: readonly Port[],
): CatanSetup {
  return {
    hexes: hexes.map((hex) => ({ ...hex })),
    ports: ports.map((port) => ({ ...port })),
    pieces: { ...config.pieces },
    costs: {
      road: { ...config.costs.road },
      settlement: { ...config.costs.settlement },
      city: { ...config.costs.city },
      developmentCard: { ...config.costs.developmentCard },
    },
    victoryPointsToWin: config.victoryPointsToWin,
    longestRouteMinimum: config.longestRouteMinimum,
    largestArmyMinimum: config.largestArmyMinimum,
    discardLimit: config.discardLimit,
  };
}

/** No settings means the variable setup. */
export function parseSettings(
  raw: unknown,
  _config: CatanConfig,
): ParseSettingsResult<CatanSettings> {
  const defaults: CatanSettings = { boardSetup: 'variable' };
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

/** The fixed setup has pieces for the base game's seats only: a larger table deals its island. */
export function validateSetup(settings: CatanSettings, playerCount: number): GameValidationResult {
  if (settings.boardSetup === 'fixed' && playerCount > BASE_MAX_PLAYERS) {
    return invalid(
      CatanRuleCodes.FixedSetupTooLarge,
      `The fixed setup is for up to ${BASE_MAX_PLAYERS} players.`,
    );
  }
  return VALID;
}

const MAX_HEXES = 61;
const MAX_COORDINATE = 10;
const MAX_FRAME_PIECES = 30;
const MAX_CARDS = 50;
const MAX_PIECES = 50;
const MAX_COST_PER_RESOURCE = 10;
const MAX_DISCARD_LIMIT = 100;
const MIN_NUMBER = 2;
const MAX_NUMBER = 12;

/**
 * Corners a board needs for the opening of that many players: every settlement rules out
 * itself and at most three neighbours, so the last one placed still finds a free corner.
 */
const minVertices = (seats: number) => 4 * (SETUP_ROUNDS * seats - 1) + 1;

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

/** `what` names the list in messages: `hexes`, or `extension.hexes`. */
function parseHexes(raw: unknown, what: string, seats: number): Hex[] {
  const hexes = parseArray(raw, what, 1, MAX_HEXES).map((hex, index): Hex => {
    const at = `${what}[${index}]`;
    if (!isRecord(hex)) fail(`${at} must be an object.`);
    return {
      q: parseInteger(hex.q, `${at}.q`, -MAX_COORDINATE, MAX_COORDINATE),
      r: parseInteger(hex.r, `${at}.r`, -MAX_COORDINATE, MAX_COORDINATE),
    };
  });
  if (new Set(hexes.map(hexKey)).size !== hexes.length) fail(`${what} contains a duplicate.`);
  if (buildTopology(hexes).vertices.length < minVertices(seats)) {
    fail(`${what} must give the board at least ${minVertices(seats)} corners to settle.`);
  }
  return hexes;
}

function parseTerrainCounts(raw: unknown, what: string, hexCount: number): Record<Terrain, number> {
  if (!isRecord(raw)) fail(`${what} must be an object with a count for each terrain.`);
  const counts = {} as Record<Terrain, number>;
  for (const terrain of TERRAINS) {
    counts[terrain] = parseInteger(raw[terrain], `${what}.${terrain}`, 0, MAX_HEXES);
  }
  const total = TERRAINS.reduce((sum, terrain) => sum + counts[terrain], 0);
  if (total !== hexCount) fail(`${what} must add up to the ${hexCount} hexes.`);
  if (counts.desert < 1) fail(`${what}.desert must be at least 1: the robber starts there.`);
  return counts;
}

function parseNumber(value: unknown, what: string): number {
  const number = parseInteger(value, what, MIN_NUMBER, MAX_NUMBER);
  if (number === ROBBER_ROLL) fail(`${what} must not be ${ROBBER_ROLL}.`);
  return number;
}

function parseNumberDiscs(raw: unknown, what: string, producingHexes: number): number[] {
  if (!Array.isArray(raw) || raw.length !== producingHexes) {
    fail(`${what} must be a list of ${producingHexes} numbers, one per producing hex.`);
  }
  return raw.map((value, index) => parseNumber(value, `${what}[${index}]`));
}

function sameItems(a: readonly (string | number)[], b: readonly (string | number)[]): boolean {
  const sorted = (items: readonly (string | number)[]) => [...items].map(String).sort().join(' ');
  return sorted(a) === sorted(b);
}

function parseFixedTiles(
  raw: unknown,
  terrainCounts: Record<Terrain, number>,
  numberDiscs: readonly number[],
  hexCount: number,
): Tile[] {
  if (!Array.isArray(raw) || raw.length !== hexCount) {
    fail(`fixedSetup.tiles must be a list of ${hexCount} tiles, one per hex.`);
  }
  const tiles = raw.map((tile, index): Tile => {
    const at = `fixedSetup.tiles[${index}]`;
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
    fail('fixedSetup.tiles must use exactly the terrains in terrainCounts.');
  }
  const numbers = tiles.flatMap((tile) => (tile.number === null ? [] : [tile.number]));
  if (!sameItems(numbers, numberDiscs)) {
    fail('fixedSetup.tiles must use exactly the numbers in numberDiscs.');
  }
  return tiles;
}

function parseHex(raw: Record<string, unknown>, what: string): Hex {
  return {
    q: parseInteger(raw.q, `${what}.q`, -MAX_COORDINATE, MAX_COORDINATE),
    r: parseInteger(raw.r, `${what}.r`, -MAX_COORDINATE, MAX_COORDINATE),
  };
}

function parseSideRef(raw: unknown, what: string): HexSideRef {
  if (!isRecord(raw)) fail(`${what} must be an object.`);
  const { side } = raw;
  if (!isHexSide(side)) fail(`${what}.side must be one of: ${HEX_SIDES.join(', ')}.`);
  return { ...parseHex(raw, what), side };
}

function parseCornerRef(raw: unknown, what: string): HexCornerRef {
  if (!isRecord(raw)) fail(`${what} must be an object.`);
  const { corner } = raw;
  if (corner !== 'N' && corner !== 'S') fail(`${what}.corner must be N or S.`);
  return { ...parseHex(raw, what), corner };
}

/** The starting pieces must be where the rules would let a player put them. */
function parseFixedSeats(raw: unknown, hexes: readonly Hex[]): StartingPieces[] {
  const topology = buildTopology(hexes);
  const settled = new Set<string>();
  const paved = new Set<string>();

  const parsePlacement = (placement: unknown, at: string): StartingPlacement => {
    if (!isRecord(placement)) fail(`${at} must be an object.`);
    const settlement = parseCornerRef(placement.settlement, `${at}.settlement`);
    const road = parseSideRef(placement.road, `${at}.road`);
    const vertex = hexCorner(settlement, settlement.corner);
    const edge = hexSideEdge(road, road.side);

    if (!topology.vertexEdges[vertex]) fail(`${at}.settlement must be a corner of the board.`);
    if (settled.has(vertex) || neighboursOf(topology, vertex).some((near) => settled.has(near))) {
      fail(`${at}.settlement must be two edges away from every other settlement.`);
    }
    if (!topology.edgeVertices[edge] || !endsOf(topology, edge).includes(vertex)) {
      fail(`${at}.road must be an edge of the board next to its settlement.`);
    }
    if (paved.has(edge)) fail(`${at}.road is on an edge that already has a road.`);
    settled.add(vertex);
    paved.add(edge);
    return { settlement, road };
  };

  if (!Array.isArray(raw) || raw.length !== BASE_MAX_PLAYERS) {
    fail(`fixedSetup.seats must be a list of ${BASE_MAX_PLAYERS} seats.`);
  }
  return raw.map((seat, index): StartingPieces => {
    const at = `fixedSetup.seats[${index}]`;
    if (!isRecord(seat)) fail(`${at} must be an object.`);
    return {
      first: parsePlacement(seat.first, `${at}.first`),
      second: parsePlacement(seat.second, `${at}.second`),
    };
  });
}

function parseFixedSetup(
  raw: unknown,
  hexes: readonly Hex[],
  terrainCounts: Record<Terrain, number>,
  numberDiscs: readonly number[],
): FixedSetup {
  if (!isRecord(raw)) fail('fixedSetup must be an object.');
  return {
    tiles: parseFixedTiles(raw.tiles, terrainCounts, numberDiscs, hexes.length),
    seats: parseFixedSeats(raw.seats, hexes),
  };
}

function parsePortType(raw: unknown, what: string): PortType {
  if (raw !== 'any' && !isResource(raw)) {
    fail(`${what} must be one of: any, ${RESOURCES.join(', ')}.`);
  }
  return raw;
}

/** The pieces must go round the whole coast, which must be a single ring to go round. */
function parseFrame(raw: unknown, what: string, hexes: readonly Hex[]): Frame {
  if (!isRecord(raw)) fail(`${what} must be an object.`);
  const start = parseSideRef(raw.start, `${what}.start`);
  const coast = listCoast(hexes, start);
  if (!coast) {
    fail(`${what}.start must be a side of a hex that faces the sea, on an island with one coast.`);
  }

  const pieces = parseArray(raw.pieces, `${what}.pieces`, 1, MAX_FRAME_PIECES).map(
    (piece, index): FramePiece => {
      const at = `${what}.pieces[${index}]`;
      if (!isRecord(piece)) fail(`${at} must be an object.`);
      const length = parseInteger(piece.length, `${at}.length`, 1, coast.length);
      const ports = parseArray(piece.ports, `${at}.ports`, 0, length).map(
        (port, portIndex): FramePort => {
          const where = `${at}.ports[${portIndex}]`;
          if (!isRecord(port)) fail(`${where} must be an object.`);
          return {
            at: parseInteger(port.at, `${where}.at`, 0, length - 1),
            type: parsePortType(port.type, `${where}.type`),
          };
        },
      );
      if (new Set(ports.map((port) => port.at)).size !== ports.length) {
        fail(`${at}.ports puts two ports on one edge.`);
      }
      return { length, ports };
    },
  );
  const covered = pieces.reduce((sum, piece) => sum + piece.length, 0);
  if (covered !== coast.length) {
    fail(`${what}.pieces must cover the ${coast.length} edges of the coast, not ${covered}.`);
  }
  return { start, pieces };
}

function parseDevelopmentCards(raw: unknown, what: string): Record<DevelopmentCardType, number> {
  if (!isRecord(raw)) fail(`${what} must be an object with a count for each card.`);
  const counts = {} as Record<DevelopmentCardType, number>;
  for (const type of DEVELOPMENT_CARD_TYPES) {
    counts[type] = parseInteger(raw[type], `${what}.${type}`, 0, MAX_CARDS);
  }
  return counts;
}

/**
 * One table's island and cards. `prefix` is what its fields are called in messages: nothing
 * for the base game's, `extension.` for the extension's.
 */
function parseTable(raw: Record<string, unknown>, prefix: string, seats: number): TableConfig {
  const hexes = parseHexes(raw.hexes, `${prefix}hexes`, seats);
  const terrainCounts = parseTerrainCounts(
    raw.terrainCounts,
    `${prefix}terrainCounts`,
    hexes.length,
  );
  return {
    hexes,
    terrainCounts,
    numberDiscs: parseNumberDiscs(
      raw.numberDiscs,
      `${prefix}numberDiscs`,
      hexes.length - terrainCounts.desert,
    ),
    frame: parseFrame(raw.frame, `${prefix}frame`, hexes),
    resourcesPerType: parseInteger(raw.resourcesPerType, `${prefix}resourcesPerType`, 1, MAX_CARDS),
    developmentCards: parseDevelopmentCards(raw.developmentCards, `${prefix}developmentCards`),
  };
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
    const base = parseTable(raw, '', BASE_MAX_PLAYERS);
    const fixedSetup = parseFixedSetup(
      raw.fixedSetup,
      base.hexes,
      base.terrainCounts,
      base.numberDiscs,
    );
    if (!isRecord(raw.extension)) {
      fail('extension must be an object: what five and six players play with.');
    }
    const extension = parseTable(raw.extension, 'extension.', MAX_PLAYERS);
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
        ...base,
        fixedSetup,
        extension,
        pieces,
        // A price must be payable from either table's supply.
        costs: parseCosts(raw.costs, Math.min(base.resourcesPerType, extension.resourcesPerType)),
        victoryPointsToWin,
        longestRouteMinimum: parseInteger(
          raw.longestRouteMinimum,
          'longestRouteMinimum',
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
