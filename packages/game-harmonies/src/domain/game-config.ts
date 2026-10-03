import type { ParseConfigResult, ParseSettingsResult } from '@bgp/game-core';
import { SIDE_A_CELLS, SIDE_B_CELLS, type TerrainKind } from './board.js';
import {
  CARD_TERRAINS,
  TERRAIN_KIND_OF,
  type AnimalCard,
  type CardTerrain,
  type HabitatCell,
} from './cards.js';
import { DEFAULT_ANIMAL_CARDS } from './default-cards.js';
import { CENTRAL_SPACE_COUNT, END_TRIGGER_EMPTY_CELLS, TOKENS_PER_SPACE } from './config.js';
import { hexKey, type Hex } from './hex.js';
import { DEFAULT_TOKEN_COUNTS, TOKEN_COLORS, type TokenColor } from './tokens.js';

export const WATER_SCORING_MODES = ['river', 'islands'] as const;

/**
 * How water scores on a map:
 * - `river`: only the longest river scores (0, 2, 5, 8, 11, 15, then +4 per extra cell);
 * - `islands`: 5 points for each island, i.e. each separate area of non-water cells.
 */
export type WaterScoring = (typeof WATER_SCORING_MODES)[number];

/** A personal board: its shape and the water scoring that goes with it. */
export interface HarmoniesMap {
  id: string;
  name: string;
  boardCells: Hex[];
  waterScoring: WaterScoring;
}

/** Everything about Harmonies that can change without changing its rules. */
export interface HarmoniesConfig {
  /** The maps a room's host can choose from. The first is the default. */
  maps: HarmoniesMap[];
  /** How many tokens of each colour go into the pouch. */
  tokenCounts: Record<TokenColor, number>;
  /** The animal card deck. */
  cards: AnimalCard[];
}

/** What a room's host chooses for a match. */
export interface HarmoniesSettings {
  mapId: string;
}

/**
 * The config as one match plays it: the chosen map folded in. This is what a match keeps in
 * its state, so it is unaffected by later config changes.
 */
export interface HarmoniesSetup {
  mapId: string;
  mapName: string;
  boardCells: Hex[];
  waterScoring: WaterScoring;
  tokenCounts: Record<TokenColor, number>;
  cards: AnimalCard[];
}

export const DEFAULT_HARMONIES_CONFIG: HarmoniesConfig = {
  maps: [
    {
      id: 'A',
      name: 'Mặt A – Sông',
      boardCells: SIDE_A_CELLS.map((cell) => ({ ...cell })),
      waterScoring: 'river',
    },
    {
      id: 'B',
      name: 'Mặt B – Đảo',
      boardCells: SIDE_B_CELLS.map((cell) => ({ ...cell })),
      waterScoring: 'islands',
    },
  ],
  tokenCounts: { ...DEFAULT_TOKEN_COUNTS },
  cards: DEFAULT_ANIMAL_CARDS.map((card) => ({
    ...card,
    pointsByAnimalsPlaced: [...card.pointsByAnimalsPlaced],
    habitat: { cells: card.habitat.cells.map((cell) => ({ ...cell })) },
  })),
};

export function resolveSetup(config: HarmoniesConfig, settings: HarmoniesSettings): HarmoniesSetup {
  const map = config.maps.find((candidate) => candidate.id === settings.mapId);
  if (!map) throw new Error(`Unknown map: ${settings.mapId}`);
  return {
    mapId: map.id,
    mapName: map.name,
    boardCells: map.boardCells,
    waterScoring: map.waterScoring,
    tokenCounts: config.tokenCounts,
    cards: config.cards,
  };
}

/** No settings means the first map; anything else must name a map in the config. */
export function parseSettings(
  raw: unknown,
  config: HarmoniesConfig,
): ParseSettingsResult<HarmoniesSettings> {
  const defaultMap = config.maps[0];
  if (!defaultMap) return { ok: false, message: 'The game has no maps configured.' };
  if (raw === undefined || raw === null) return { ok: true, settings: { mapId: defaultMap.id } };

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Settings must be an object.' };
  }
  const mapId = (raw as Record<string, unknown>).mapId ?? defaultMap.id;
  if (typeof mapId !== 'string' || !config.maps.some((map) => map.id === mapId)) {
    return {
      ok: false,
      message: `mapId must be one of: ${config.maps.map((map) => map.id).join(', ')}.`,
    };
  }
  return { ok: true, settings: { mapId } };
}

const MIN_BOARD_CELLS = END_TRIGGER_EMPTY_CELLS + 5;
const MAX_BOARD_CELLS = 91;
const MAX_COORDINATE = 20;
const MAX_TOKENS_PER_COLOR = 200;
const MIN_TOTAL_TOKENS = CENTRAL_SPACE_COUNT * TOKENS_PER_SPACE;
const MAX_CARDS = 100;
const MIN_HABITAT_CELLS = 2;
const MAX_HABITAT_CELLS = 6;
const MAX_HABITAT_COORDINATE = 4;
const MAX_CUBES_PER_CARD = 8;
const MAX_NAME_LENGTH = 40;
const MAX_MAPS = 12;

/** The heights each terrain can actually reach under the stacking rules. */
const POSSIBLE_HEIGHTS: Readonly<Record<TerrainKind, readonly number[]>> = {
  water: [1],
  field: [1],
  mountain: [1, 2, 3],
  tree: [1, 2, 3],
  building: [2],
};

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

function parseText(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > MAX_NAME_LENGTH) {
    fail(`${what} must be a non-empty string of at most ${MAX_NAME_LENGTH} characters.`);
  }
  return value;
}

function parseArray(value: unknown, what: string, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail(`${what} must be a list of ${min} to ${max} items.`);
  }
  return value;
}

function parseHex(value: unknown, what: string, limit: number): Hex {
  if (!isRecord(value)) fail(`${what} must be { q, r }.`);
  return {
    q: parseInteger(value.q, `${what}.q`, -limit, limit),
    r: parseInteger(value.r, `${what}.r`, -limit, limit),
  };
}

function parseBoardCells(raw: unknown, what: string): Hex[] {
  const cells = parseArray(raw, what, MIN_BOARD_CELLS, MAX_BOARD_CELLS).map((cell, index) =>
    parseHex(cell, `${what}[${index}]`, MAX_COORDINATE),
  );
  if (new Set(cells.map(hexKey)).size !== cells.length) fail(`${what} contains a duplicate.`);
  return cells;
}

function parseMaps(raw: unknown): HarmoniesMap[] {
  const maps = parseArray(raw, 'maps', 1, MAX_MAPS).map((map, index): HarmoniesMap => {
    const at = `maps[${index}]`;
    if (!isRecord(map)) fail(`${at} must be an object.`);
    const waterScoring = map.waterScoring;
    if (
      typeof waterScoring !== 'string' ||
      !(WATER_SCORING_MODES as readonly string[]).includes(waterScoring)
    ) {
      fail(`${at}.waterScoring must be one of: ${WATER_SCORING_MODES.join(', ')}.`);
    }
    return {
      id: parseText(map.id, `${at}.id`),
      name: parseText(map.name, `${at}.name`),
      boardCells: parseBoardCells(map.boardCells, `${at}.boardCells`),
      waterScoring: waterScoring as WaterScoring,
    };
  });
  if (new Set(maps.map((map) => map.id)).size !== maps.length)
    fail('maps contains a duplicate id.');
  return maps;
}

function parseTokenCounts(raw: unknown): Record<TokenColor, number> {
  if (!isRecord(raw)) fail('tokenCounts must be an object.');
  const counts = Object.fromEntries(
    TOKEN_COLORS.map((color) => [
      color,
      parseInteger(raw[color], `tokenCounts.${color}`, 0, MAX_TOKENS_PER_COLOR),
    ]),
  ) as Record<TokenColor, number>;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total < MIN_TOTAL_TOKENS) {
    fail(`tokenCounts must add up to at least ${MIN_TOTAL_TOKENS} to fill the central board.`);
  }
  return counts;
}

function parseHabitatCells(raw: unknown, what: string): HabitatCell[] {
  if (!isRecord(raw)) fail(`${what} must be an object with a cells list.`);
  const cells = parseArray(raw.cells, `${what}.cells`, MIN_HABITAT_CELLS, MAX_HABITAT_CELLS).map(
    (cell, index): HabitatCell => {
      const at = `${what}.cells[${index}]`;
      if (!isRecord(cell)) fail(`${at} must be an object.`);
      const { q, r } = parseHex(cell, at, MAX_HABITAT_COORDINATE);

      const terrain = cell.terrain;
      if (typeof terrain !== 'string' || !(CARD_TERRAINS as readonly string[]).includes(terrain)) {
        fail(`${at}.terrain must be one of: ${CARD_TERRAINS.join(', ')}.`);
      }
      const possible = POSSIBLE_HEIGHTS[TERRAIN_KIND_OF[terrain as CardTerrain]];
      if (!possible.includes(cell.height as number)) {
        fail(`${at}.height must be one of ${possible.join(', ')} for ${terrain}.`);
      }
      if (typeof cell.animalSlot !== 'boolean') fail(`${at}.animalSlot must be true or false.`);

      return {
        q,
        r,
        terrain: terrain as CardTerrain,
        height: cell.height as number,
        animalSlot: cell.animalSlot,
      };
    },
  );

  if (new Set(cells.map(hexKey)).size !== cells.length) {
    fail(`${what}.cells uses the same position twice.`);
  }
  if (cells.filter((cell) => cell.animalSlot).length !== 1) {
    fail(`${what}.cells must mark exactly one cell as the animalSlot.`);
  }
  return cells;
}

function parsePoints(raw: unknown, what: string): number[] {
  // Entry 0 is the score with no animals placed, so a card needs at least two entries.
  const points = parseArray(raw, what, 2, MAX_CUBES_PER_CARD + 1).map((value, index) =>
    parseInteger(value, `${what}[${index}]`, 0, 1000),
  );
  if (points.some((value, index) => index > 0 && value < (points[index - 1] ?? 0))) {
    fail(`${what} must not decrease.`);
  }
  return points;
}

function parseCards(raw: unknown): AnimalCard[] {
  const cards = parseArray(raw, 'cards', 0, MAX_CARDS).map((card, index): AnimalCard => {
    const at = `cards[${index}]`;
    if (!isRecord(card)) fail(`${at} must be an object.`);
    return {
      id: parseText(card.id, `${at}.id`),
      ...(card.sourceId === undefined || card.sourceId === null
        ? {}
        : { sourceId: parseInteger(card.sourceId, `${at}.sourceId`, 0, 100000) }),
      ...(card.name === undefined || card.name === null
        ? {}
        : { name: parseText(card.name, `${at}.name`) }),
      pointsByAnimalsPlaced: parsePoints(card.pointsByAnimalsPlaced, `${at}.pointsByAnimalsPlaced`),
      habitat: { cells: parseHabitatCells(card.habitat, `${at}.habitat`) },
    };
  });
  if (new Set(cards.map((card) => card.id)).size !== cards.length) {
    fail('cards contains a duplicate id.');
  }
  return cards;
}

/**
 * Validates a config from an untrusted source and returns a clean copy holding only known
 * fields. Anything accepted here must be playable to the end by the engine.
 */
export function parseConfig(raw: unknown): ParseConfigResult<HarmoniesConfig> {
  try {
    if (!isRecord(raw)) fail('Config must be an object.');
    return {
      ok: true,
      config: {
        maps: parseMaps(raw.maps),
        tokenCounts: parseTokenCounts(raw.tokenCounts),
        cards: parseCards(raw.cards),
      },
    };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, message: error.message };
    throw error;
  }
}
