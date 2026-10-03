import type { ParseConfigResult } from '@bgp/game-core';
import { DEFAULT_BOARD_CELLS, TERRAIN_KINDS, type TerrainKind } from './board.js';
import {
  DEFAULT_ANIMAL_CARDS,
  type AnimalCard,
  type HabitatCell,
  type TerrainRequirement,
} from './cards.js';
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
}

export const DEFAULT_HARMONIES_CONFIG: HarmoniesConfig = {
  boardCells: DEFAULT_BOARD_CELLS.map((cell) => ({ ...cell })),
  tokenCounts: { ...DEFAULT_TOKEN_COUNTS },
  cards: DEFAULT_ANIMAL_CARDS.map((card) => ({
    ...card,
    cubeOn: { ...card.cubeOn },
    habitat: card.habitat.map((cell) => ({
      offset: { ...cell.offset },
      requires: { ...cell.requires },
    })),
    points: [...card.points],
  })),
};

const MIN_BOARD_CELLS = END_TRIGGER_EMPTY_CELLS + 5;
const MAX_BOARD_CELLS = 91;
const MAX_COORDINATE = 20;
const MAX_TOKENS_PER_COLOR = 200;
const MIN_TOTAL_TOKENS = CENTRAL_SPACE_COUNT * TOKENS_PER_SPACE;
const MAX_CARDS = 100;
const MAX_HABITAT_CELLS = 4;
const MAX_HABITAT_OFFSET = 2;
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

function parseRequirement(raw: unknown, what: string): TerrainRequirement {
  if (!isRecord(raw)) fail(`${what} must be an object.`);
  const kind = raw.kind;
  if (typeof kind !== 'string' || !(TERRAIN_KINDS as readonly string[]).includes(kind)) {
    fail(`${what}.kind must be one of: ${TERRAIN_KINDS.join(', ')}.`);
  }
  const terrain = kind as TerrainKind;
  if (raw.height === undefined || raw.height === null) return { kind: terrain };
  if (!POSSIBLE_HEIGHTS[terrain].includes(raw.height as number)) {
    fail(`${what}.height must be one of ${POSSIBLE_HEIGHTS[terrain].join(', ')} for ${terrain}.`);
  }
  return { kind: terrain, height: raw.height as number };
}

function parseHabitat(raw: unknown, what: string): HabitatCell[] {
  const habitat = parseArray(raw, what, 1, MAX_HABITAT_CELLS).map((cell, index) => {
    const at = `${what}[${index}]`;
    if (!isRecord(cell)) fail(`${at} must be an object.`);
    const offset = parseHex(cell.offset, `${at}.offset`, MAX_HABITAT_OFFSET);
    if (offset.q === 0 && offset.r === 0) fail(`${at}.offset must not be the animal's own cell.`);
    return { offset, requires: parseRequirement(cell.requires, `${at}.requires`) };
  });
  if (new Set(habitat.map((cell) => hexKey(cell.offset))).size !== habitat.length) {
    fail(`${what} uses the same offset twice.`);
  }
  return habitat;
}

function parsePoints(raw: unknown, what: string): number[] {
  const points = parseArray(raw, what, 1, MAX_CUBES_PER_CARD).map((value, index) =>
    parseInteger(value, `${what}[${index}]`, 0, 1000),
  );
  if (points.some((value, index) => index > 0 && value < (points[index - 1] ?? 0))) {
    fail(`${what} must not decrease.`);
  }
  return points;
}

function parseCards(raw: unknown): AnimalCard[] {
  const cards = parseArray(raw, 'cards', 0, MAX_CARDS).map((card, index) => {
    const at = `cards[${index}]`;
    if (!isRecord(card)) fail(`${at} must be an object.`);
    return {
      id: parseText(card.id, `${at}.id`),
      name: parseText(card.name, `${at}.name`),
      cubeOn: parseRequirement(card.cubeOn, `${at}.cubeOn`),
      habitat: parseHabitat(card.habitat, `${at}.habitat`),
      points: parsePoints(card.points, `${at}.points`),
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
        boardCells: parseBoardCells(raw.boardCells),
        tokenCounts: parseTokenCounts(raw.tokenCounts),
        cards: parseCards(raw.cards),
      },
    };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, message: error.message };
    throw error;
  }
}
