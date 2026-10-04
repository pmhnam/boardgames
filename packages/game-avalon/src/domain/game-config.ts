import type { GameValidationResult, ParseConfigResult, ParseSettingsResult } from '@bgp/game-core';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_COUNTS,
  QUEST_COUNT,
  type PlayerCount,
} from './config.js';
import { AvalonRuleCodes } from './errors.js';
import {
  OPTIONAL_ROLES,
  alignmentOf,
  isOptionalRole,
  type OptionalRole,
  type Role,
} from './roles.js';

/** How a table of a given size is set up. */
export interface PlayerCountSetup {
  /** Players on the evil side. The rest are good. */
  evil: number;
  /** Players sent on each quest. */
  teamSizes: number[];
  /** Fail cards it takes to fail each quest. */
  failsRequired: number[];
}

/** Everything about Avalon that can change without changing its rules. */
export interface AvalonConfig {
  setupByPlayerCount: Record<PlayerCount, PlayerCountSetup>;
  /** Proposals for one quest rejected in a row that hand evil the game. */
  maxRejections: number;
  /** Quests, counted from 1, after which the Lady of the Lake is used. */
  ladyAfterQuests: number[];
  /** The roles a room's host may add. */
  optionalRoles: OptionalRole[];
}

/** What a room's host chooses for a match. */
export interface AvalonSettings {
  roles: OptionalRole[];
  ladyOfTheLake: boolean;
}

/**
 * The config as one match plays it. This is what a match keeps in its state, so it is
 * unaffected by later config changes.
 */
export interface AvalonRules {
  teamSizes: number[];
  failsRequired: number[];
  maxRejections: number;
  /** Empty when the Lady of the Lake is not in play. */
  ladyAfterQuests: number[];
}

export const DEFAULT_AVALON_CONFIG: AvalonConfig = {
  setupByPlayerCount: {
    5: { evil: 2, teamSizes: [2, 3, 2, 3, 3], failsRequired: [1, 1, 1, 1, 1] },
    6: { evil: 2, teamSizes: [2, 3, 4, 3, 4], failsRequired: [1, 1, 1, 1, 1] },
    7: { evil: 3, teamSizes: [2, 3, 3, 4, 4], failsRequired: [1, 1, 1, 2, 1] },
    8: { evil: 3, teamSizes: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
    9: { evil: 3, teamSizes: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
    10: { evil: 4, teamSizes: [3, 4, 4, 5, 5], failsRequired: [1, 1, 1, 2, 1] },
  },
  maxRejections: 5,
  ladyAfterQuests: [2, 3, 4],
  optionalRoles: [...OPTIONAL_ROLES],
};

/**
 * No settings means the plain game. Whether the chosen roles fit depends on how many people
 * sit down, which is only known when the match is set up: see `getRolesInPlay`.
 */
export function parseSettings(
  raw: unknown,
  config: AvalonConfig,
): ParseSettingsResult<AvalonSettings> {
  if (raw === undefined || raw === null) {
    return { ok: true, settings: { roles: [], ladyOfTheLake: false } };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, message: 'Settings must be an object.' };
  }

  const { roles = [], ladyOfTheLake = false } = raw as Record<string, unknown>;
  if (!Array.isArray(roles) || !roles.every((role) => config.optionalRoles.includes(role))) {
    return {
      ok: false,
      message: `roles must be a list of: ${config.optionalRoles.join(', ') || 'nothing'}.`,
    };
  }
  if (typeof ladyOfTheLake !== 'boolean') {
    return { ok: false, message: 'ladyOfTheLake must be true or false.' };
  }
  return {
    ok: true,
    settings: { roles: OPTIONAL_ROLES.filter((role) => roles.includes(role)), ladyOfTheLake },
  };
}

function isPlayerCount(count: number): count is PlayerCount {
  return PLAYER_COUNTS.includes(count as PlayerCount);
}

/**
 * One role per seat, good first: Merlin, the Assassin and the chosen roles, filled up with
 * Loyal Servants and Minions. Null when the chosen roles outnumber the seats on their side.
 */
export function getRolesInPlay(
  playerCount: number,
  roles: readonly OptionalRole[],
  config: AvalonConfig,
): Role[] | null {
  if (!isPlayerCount(playerCount)) return null;
  const { evil } = config.setupByPlayerCount[playerCount];

  const good: Role[] = ['MERLIN', ...roles.filter((role) => alignmentOf(role) === 'GOOD')];
  const bad: Role[] = ['ASSASSIN', ...roles.filter((role) => alignmentOf(role) === 'EVIL')];
  const servants = playerCount - evil - good.length;
  const minions = evil - bad.length;
  if (servants < 0 || minions < 0) return null;

  return [
    ...good,
    ...Array.from({ length: servants }, (): Role => 'LOYAL_SERVANT'),
    ...bad,
    ...Array.from({ length: minions }, (): Role => 'MINION'),
  ];
}

/** The smallest table the chosen roles fit at, so a host can be told before starting. */
export function minPlayersFor(roles: readonly OptionalRole[], config: AvalonConfig): number | null {
  return PLAYER_COUNTS.find((count) => getRolesInPlay(count, roles, config) !== null) ?? null;
}

/**
 * Whether a match can be set up as asked for this many players. The platform asks before a
 * match starts, and the room's settings form shows the same answer.
 */
export function validateSetup(
  playerCount: number,
  settings: AvalonSettings,
  config: AvalonConfig,
): GameValidationResult {
  if (!isPlayerCount(playerCount)) {
    return {
      valid: false,
      code: AvalonRuleCodes.InvalidPlayerCount,
      message: `Avalon needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`,
    };
  }
  if (getRolesInPlay(playerCount, settings.roles, config)) return { valid: true };

  const needed = minPlayersFor(settings.roles, config);
  return {
    valid: false,
    code: AvalonRuleCodes.RolesDoNotFit,
    message:
      needed === null
        ? 'The chosen roles do not fit at any table. Remove one.'
        : `The chosen roles need at least ${needed} players. Remove one, or wait for more players.`,
  };
}

const MAX_REJECTIONS = 20;

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

function parsePerQuest(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value) || value.length !== QUEST_COUNT) {
    fail(`${what} must list ${QUEST_COUNT} quests.`);
  }
  return value;
}

function parseSetup(raw: unknown, count: PlayerCount): PlayerCountSetup {
  const at = `setupByPlayerCount.${count}`;
  if (!isRecord(raw)) fail(`${at} must be an object.`);
  const teamSizes = parsePerQuest(raw.teamSizes, `${at}.teamSizes`).map((size, quest) =>
    parseInteger(size, `${at}.teamSizes[${quest}]`, 1, count),
  );
  return {
    // Merlin and the Assassin each need a seat on their own side.
    evil: parseInteger(raw.evil, `${at}.evil`, 1, count - 1),
    teamSizes,
    failsRequired: parsePerQuest(raw.failsRequired, `${at}.failsRequired`).map((fails, quest) =>
      parseInteger(fails, `${at}.failsRequired[${quest}]`, 1, teamSizes[quest] ?? 1),
    ),
  };
}

function parseLadyQuests(raw: unknown): number[] {
  if (!Array.isArray(raw)) fail('ladyAfterQuests must be a list.');
  // After the last quest the game is over. Every use needs someone who has not held the Lady
  // yet, and even the smallest table has one for each of the other quests.
  const quests = raw.map((quest, index) =>
    parseInteger(quest, `ladyAfterQuests[${index}]`, 1, QUEST_COUNT - 1),
  );
  if (new Set(quests).size !== quests.length) fail('ladyAfterQuests contains a duplicate.');
  return quests.sort((a, b) => a - b);
}

function parseOptionalRoles(raw: unknown): OptionalRole[] {
  if (!Array.isArray(raw) || !raw.every(isOptionalRole)) {
    fail(`optionalRoles must be a list of: ${OPTIONAL_ROLES.join(', ')}.`);
  }
  return OPTIONAL_ROLES.filter((role) => raw.includes(role));
}

/**
 * Validates a config from an untrusted source and returns a clean copy holding only known
 * fields. Anything accepted here must be playable to the end by the engine.
 */
export function parseConfig(raw: unknown): ParseConfigResult<AvalonConfig> {
  try {
    if (!isRecord(raw)) fail('Config must be an object.');
    const setups = raw.setupByPlayerCount;
    if (!isRecord(setups)) fail('setupByPlayerCount must be an object.');
    const setup = (count: PlayerCount) => parseSetup(setups[String(count)], count);

    return {
      ok: true,
      config: {
        setupByPlayerCount: {
          5: setup(5),
          6: setup(6),
          7: setup(7),
          8: setup(8),
          9: setup(9),
          10: setup(10),
        },
        maxRejections: parseInteger(raw.maxRejections, 'maxRejections', 1, MAX_REJECTIONS),
        ladyAfterQuests: parseLadyQuests(raw.ladyAfterQuests),
        optionalRoles: parseOptionalRoles(raw.optionalRoles),
      },
    };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, message: error.message };
    throw error;
  }
}
