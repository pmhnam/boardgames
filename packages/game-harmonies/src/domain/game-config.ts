import type { ParseConfigResult } from '@bgp/game-core';
import { DEFAULT_BOARD_CELLS, type TerrainKind } from './board.js';
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

/** Everything about Harmonies that can change without changing its rules. */
export interface HarmoniesConfig {
  /** The cells of every player's personal board. */
  boardCells: Hex[];
  /** How many tokens of each colour go into the pouch. */
  tokenCounts: Record<TokenColor, number>;
  /** The animal card deck. */
  cards: AnimalCard[];
  /**
   * How water scores, matching the two sides of the printed board:
   * - `islands`: 5 points for each island, i.e. each separate area of non-water cells;
   * - `river`: only the longest river scores (0, 2, 5, 8, 11, 15, then +4 per extra cell).
   */
  waterScoring: WaterScoring;
}

export const WATER_SCORING_MODES = ['islands', 'river'] as const;

export type WaterScoring = (typeof WATER_SCORING_MODES)[number];

const DEFAULT_WATER_SCORING: WaterScoring = 'islands';

export const DEFAULT_HARMONIES_CONFIG: HarmoniesConfig = {
  boardCells: DEFAULT_BOARD_CELLS.map((cell) => ({ ...cell })),
  tokenCounts: { ...DEFAULT_TOKEN_COUNTS },
  cards: DEFAULT_ANIMAL_CARDS.map((card) => ({
    ...card,
    pointsByAnimalsPlaced: [...card.pointsByAnimalsPlaced],
    habitat: { cells: card.habitat.cells.map((cell) => ({ ...cell })) },
  })),
  waterScoring: DEFAULT_WATER_SCORING,
};

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

function parseBoardCells(raw: unknown): Hex[] {
  const cells = parseArray(raw, 'boardCells', MIN_BOARD_CELLS, MAX_BOARD_CELLS).map((cell, index) =>
    parseHex(cell, `boardCells[${index}]`, MAX_COORDINATE),
  );
  if (new Set(cells.map(hexKey)).size !== cells.length) fail('boardCells contains a duplicate.');
  return cells;
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

/** Optional, so configs stored before this setting existed stay valid. */
function parseWaterScoring(raw: unknown): WaterScoring {
  if (raw === undefined || raw === null) return DEFAULT_WATER_SCORING;
  if (typeof raw !== 'string' || !(WATER_SCORING_MODES as readonly string[]).includes(raw)) {
    fail(`waterScoring must be one of: ${WATER_SCORING_MODES.join(', ')}.`);
  }
  return raw as WaterScoring;
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
        boardCells: parseBoardCells(raw.boardCells),
        tokenCounts: parseTokenCounts(raw.tokenCounts),
        cards: parseCards(raw.cards),
        waterScoring: parseWaterScoring(raw.waterScoring),
      },
    };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, message: error.message };
    throw error;
  }
}
