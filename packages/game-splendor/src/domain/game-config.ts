import type { ParseConfigResult, ParseSettingsResult } from '@bgp/game-core';
import { TIERS, isTier, type DevelopmentCard, type Noble } from './cards.js';
import {
  MAX_PLAYERS,
  MAX_RESERVED,
  PLAYER_COUNTS,
  TOKEN_LIMIT,
  type PlayerCount,
} from './config.js';
import { DEFAULT_DEVELOPMENT_CARDS } from './default-cards.js';
import { DEFAULT_NOBLES } from './default-nobles.js';
import { GEM_COLORS, emptyGems, isGemColor, type GemCounts } from './gems.js';

/** What goes on the table for a given number of players. */
export interface PlayerCountSetup {
  /** Tokens of each gem colour in the bank. */
  gemsPerColor: number;
  /** Noble tiles revealed. */
  nobles: number;
}

/** Everything about Splendor that can change without changing its rules. */
export interface SplendorConfig {
  cards: DevelopmentCard[];
  nobles: Noble[];
  setupByPlayerCount: Record<PlayerCount, PlayerCountSetup>;
  goldCount: number;
  /** The winning scores a room's host can choose from. */
  targetScoreOptions: number[];
  defaultTargetScore: number;
}

/** What a room's host chooses for a match. */
export interface SplendorSettings {
  targetScore: number;
}

/**
 * The config as one match plays it. This is what a match keeps in its state, so it is
 * unaffected by later config changes.
 */
export interface SplendorSetup {
  targetScore: number;
  cards: DevelopmentCard[];
  /** Only the nobles dealt to this match. */
  nobles: Noble[];
}

export const DEFAULT_SPLENDOR_CONFIG: SplendorConfig = {
  cards: DEFAULT_DEVELOPMENT_CARDS.map((card) => ({ ...card, cost: { ...card.cost } })),
  nobles: DEFAULT_NOBLES.map((noble) => ({ ...noble, requirement: { ...noble.requirement } })),
  setupByPlayerCount: {
    2: { gemsPerColor: 4, nobles: 3 },
    3: { gemsPerColor: 5, nobles: 4 },
    4: { gemsPerColor: 7, nobles: 5 },
  },
  goldCount: 5,
  targetScoreOptions: [10, 15, 20],
  defaultTargetScore: 15,
};

/** No settings means the default target; anything else must be one the config offers. */
export function parseSettings(
  raw: unknown,
  config: SplendorConfig,
): ParseSettingsResult<SplendorSettings> {
  const defaults = { targetScore: config.defaultTargetScore };
  if (raw === undefined || raw === null) return { ok: true, settings: defaults };

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Settings must be an object.' };
  }
  const targetScore = (raw as Record<string, unknown>).targetScore ?? defaults.targetScore;
  if (typeof targetScore !== 'number' || !config.targetScoreOptions.includes(targetScore)) {
    return {
      ok: false,
      message: `targetScore must be one of: ${config.targetScoreOptions.join(', ')}.`,
    };
  }
  return { ok: true, settings: { targetScore } };
}

const MAX_CARDS = 300;
const MAX_NOBLES = 50;
const MAX_COST_PER_COLOR = 20;
const MAX_POINTS = 50;
const MAX_TOKENS_PER_COLOR = 50;
const MAX_TARGET_SCORE = 200;
const MAX_TARGET_OPTIONS = 10;
const MAX_NAME_LENGTH = 60;

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

function parseGems(raw: unknown, what: string): GemCounts {
  if (!isRecord(raw)) fail(`${what} must be an object with a count for each gem colour.`);
  const gems = emptyGems();
  for (const color of GEM_COLORS) {
    gems[color] = parseInteger(raw[color], `${what}.${color}`, 0, MAX_COST_PER_COLOR);
  }
  return gems;
}

function requireUniqueIds(items: readonly { id: string }[], what: string): void {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    fail(`${what} contains a duplicate id.`);
  }
}

function parseCards(raw: unknown): DevelopmentCard[] {
  const cards = parseArray(raw, 'cards', 1, MAX_CARDS).map((card, index): DevelopmentCard => {
    const at = `cards[${index}]`;
    if (!isRecord(card)) fail(`${at} must be an object.`);
    const { tier, bonus } = card;
    if (!isTier(tier)) fail(`${at}.tier must be one of: ${TIERS.join(', ')}.`);
    if (!isGemColor(bonus)) fail(`${at}.bonus must be one of: ${GEM_COLORS.join(', ')}.`);
    return {
      id: parseText(card.id, `${at}.id`),
      tier,
      bonus,
      points: parseInteger(card.points, `${at}.points`, 0, MAX_POINTS),
      cost: parseGems(card.cost, `${at}.cost`),
    };
  });
  requireUniqueIds(cards, 'cards');
  return cards;
}

function parseNobles(raw: unknown): Noble[] {
  const nobles = parseArray(raw, 'nobles', 0, MAX_NOBLES).map((noble, index): Noble => {
    const at = `nobles[${index}]`;
    if (!isRecord(noble)) fail(`${at} must be an object.`);
    const requirement = parseGems(noble.requirement, `${at}.requirement`);
    if (GEM_COLORS.every((color) => requirement[color] === 0)) {
      fail(`${at}.requirement must ask for at least one bonus.`);
    }
    return {
      id: parseText(noble.id, `${at}.id`),
      name: parseText(noble.name, `${at}.name`),
      points: parseInteger(noble.points, `${at}.points`, 0, MAX_POINTS),
      requirement,
    };
  });
  requireUniqueIds(nobles, 'nobles');
  return nobles;
}

function parseSetups(raw: unknown, nobleCount: number): Record<PlayerCount, PlayerCountSetup> {
  if (!isRecord(raw)) fail('setupByPlayerCount must be an object.');
  const parseOne = (count: PlayerCount): PlayerCountSetup => {
    const at = `setupByPlayerCount.${count}`;
    const setup = raw[String(count)];
    if (!isRecord(setup)) fail(`${at} must be an object.`);
    return {
      gemsPerColor: parseInteger(setup.gemsPerColor, `${at}.gemsPerColor`, 1, MAX_TOKENS_PER_COLOR),
      nobles: parseInteger(setup.nobles, `${at}.nobles`, 0, nobleCount),
    };
  };
  return { 2: parseOne(2), 3: parseOne(3), 4: parseOne(4) };
}

function parseTargetScores(raw: unknown): number[] {
  const options = parseArray(raw, 'targetScoreOptions', 1, MAX_TARGET_OPTIONS).map((value, index) =>
    parseInteger(value, `targetScoreOptions[${index}]`, 1, MAX_TARGET_SCORE),
  );
  if (new Set(options).size !== options.length) fail('targetScoreOptions contains a duplicate.');
  return options;
}

/**
 * The first card nobody could ever buy with this many tokens on the table, if there is one.
 * Starts from the cards payable with no bonuses, adds what they give, and repeats.
 */
function findUnbuyableCard(
  cards: readonly DevelopmentCard[],
  gemsPerColor: number,
  goldCount: number,
): DevelopmentCard | undefined {
  const bonuses = emptyGems();
  let remaining = [...cards];
  for (;;) {
    const stillOut = remaining.filter((card) => {
      const residual = GEM_COLORS.map((color) => Math.max(0, card.cost[color] - bonuses[color]));
      const total = residual.reduce((sum, count) => sum + count, 0);
      const gold = residual.reduce((sum, count) => sum + Math.max(0, count - gemsPerColor), 0);
      return total > TOKEN_LIMIT || gold > goldCount;
    });
    if (stillOut.length === remaining.length) return stillOut[0];
    for (const card of remaining) if (!stillOut.includes(card)) bonuses[card.bonus] += 1;
    remaining = stillOut;
  }
}

/**
 * A match must be able to end: even with the best cards stuck in reserves, buying everything
 * else has to push somebody to the highest target.
 */
function requireReachableTarget(cards: readonly DevelopmentCard[], maxTarget: number): void {
  const points = cards.map((card) => card.points).sort((a, b) => b - a);
  const reachable = points.slice(MAX_RESERVED * MAX_PLAYERS).reduce((sum, value) => sum + value, 0);
  const needed = MAX_PLAYERS * (maxTarget - 1) + 1;
  if (reachable < needed) {
    fail(
      `cards are worth too few points for a target of ${maxTarget}: ` +
        `${reachable} outside the best ${MAX_RESERVED * MAX_PLAYERS}, ${needed} needed.`,
    );
  }
}

/**
 * Validates a config from an untrusted source and returns a clean copy holding only known
 * fields. Anything accepted here must be playable to the end by the engine.
 */
export function parseConfig(raw: unknown): ParseConfigResult<SplendorConfig> {
  try {
    if (!isRecord(raw)) fail('Config must be an object.');
    const cards = parseCards(raw.cards);
    const nobles = parseNobles(raw.nobles);
    const setupByPlayerCount = parseSetups(raw.setupByPlayerCount, nobles.length);
    const goldCount = parseInteger(raw.goldCount, 'goldCount', 0, MAX_TOKENS_PER_COLOR);
    const targetScoreOptions = parseTargetScores(raw.targetScoreOptions);
    const defaultTargetScore = raw.defaultTargetScore;
    if (
      typeof defaultTargetScore !== 'number' ||
      !targetScoreOptions.includes(defaultTargetScore)
    ) {
      fail(`defaultTargetScore must be one of: ${targetScoreOptions.join(', ')}.`);
    }

    for (const count of PLAYER_COUNTS) {
      const stuck = findUnbuyableCard(cards, setupByPlayerCount[count].gemsPerColor, goldCount);
      if (stuck) fail(`Card ${stuck.id} can never be bought in a ${count}-player game.`);
    }
    requireReachableTarget(cards, Math.max(...targetScoreOptions));

    return {
      ok: true,
      config: {
        cards,
        nobles,
        setupByPlayerCount,
        goldCount,
        targetScoreOptions,
        defaultTargetScore,
      },
    };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, message: error.message };
    throw error;
  }
}
