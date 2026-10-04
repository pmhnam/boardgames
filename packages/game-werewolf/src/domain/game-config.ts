import type { ParseConfigResult, ParseSettingsResult } from '@bgp/game-core';
import { MAX_PLAYERS, MIN_PLAYERS } from './config.js';
import { CompositionCodes, type CompositionCode } from './errors.js';
import {
  ROLE_IDS,
  SPECIAL_ROLE_IDS,
  countWolves,
  type RoleCounts,
  type RoleId,
  type SpecialRoleCounts,
  type SpecialRoleId,
} from './roles.js';

/** Whether a role may be put in a match at all, and how many of it at most. */
export interface RoleLimit {
  enabled: boolean;
  max: number;
}

/** The house rules an operator can tune. */
export interface WerewolfRules {
  guardCanProtectSelf: boolean;
  witchCanHealSelf: boolean;
  /** How many votes the alpha werewolf's choice of victim counts for. */
  alphaVoteWeight: number;
  /** Werewolf attacks an elder survives. */
  elderExtraLives: number;
}

/** Everything about Werewolf that can change without changing its rules. */
export interface WerewolfConfig {
  roles: Record<SpecialRoleId, RoleLimit>;
  /**
   * The suggested special roles for each table size, keyed by player count. Villagers fill
   * the seats that are left.
   */
  presets: Record<string, Partial<SpecialRoleCounts>>;
  rules: WerewolfRules;
  defaultRevealRoleOnDeath: boolean;
}

/** What a room's host chooses for a match. */
export interface WerewolfSettings {
  /** 'recommended' follows the config's suggestion for however many are seated at the start. */
  preset: 'recommended' | 'custom';
  /** The special roles in play when the preset is 'custom'. */
  roles?: SpecialRoleCounts;
  /** Whether a dead player's role is shown to everyone. */
  revealRoleOnDeath: boolean;
}

/**
 * The config as one match plays it. This is what a match keeps in its state, so it is
 * unaffected by later config changes.
 */
export interface WerewolfSetup {
  rules: WerewolfRules;
  revealRoleOnDeath: boolean;
  /** The cast the match was dealt, villagers included. */
  roleCounts: RoleCounts;
}

export const DEFAULT_WEREWOLF_CONFIG: WerewolfConfig = {
  roles: {
    werewolf: { enabled: true, max: 6 },
    alphaWerewolf: { enabled: true, max: 1 },
    seer: { enabled: true, max: 1 },
    bodyguard: { enabled: true, max: 1 },
    witch: { enabled: true, max: 1 },
    hunter: { enabled: true, max: 2 },
    cupid: { enabled: true, max: 1 },
    elder: { enabled: true, max: 1 },
    idiot: { enabled: true, max: 1 },
  },
  presets: {
    5: { werewolf: 1, seer: 1, bodyguard: 1 },
    6: { werewolf: 2, seer: 1, witch: 1 },
    7: { werewolf: 2, seer: 1, bodyguard: 1, witch: 1 },
    8: { werewolf: 2, seer: 1, bodyguard: 1, witch: 1, hunter: 1 },
    9: { werewolf: 2, seer: 1, bodyguard: 1, witch: 1, hunter: 1 },
    10: { werewolf: 2, alphaWerewolf: 1, seer: 1, bodyguard: 1, witch: 1, hunter: 1 },
    11: { werewolf: 2, alphaWerewolf: 1, seer: 1, bodyguard: 1, witch: 1, hunter: 1, cupid: 1 },
    12: {
      werewolf: 2,
      alphaWerewolf: 1,
      seer: 1,
      bodyguard: 1,
      witch: 1,
      hunter: 1,
      cupid: 1,
      elder: 1,
    },
    13: {
      werewolf: 3,
      alphaWerewolf: 1,
      seer: 1,
      bodyguard: 1,
      witch: 1,
      hunter: 1,
      cupid: 1,
      elder: 1,
    },
    14: {
      werewolf: 3,
      alphaWerewolf: 1,
      seer: 1,
      bodyguard: 1,
      witch: 1,
      hunter: 1,
      cupid: 1,
      elder: 1,
      idiot: 1,
    },
    15: {
      werewolf: 3,
      alphaWerewolf: 1,
      seer: 1,
      bodyguard: 1,
      witch: 1,
      hunter: 1,
      cupid: 1,
      elder: 1,
      idiot: 1,
    },
    16: {
      werewolf: 4,
      alphaWerewolf: 1,
      seer: 1,
      bodyguard: 1,
      witch: 1,
      hunter: 1,
      cupid: 1,
      elder: 1,
      idiot: 1,
    },
  },
  rules: {
    guardCanProtectSelf: true,
    witchCanHealSelf: true,
    alphaVoteWeight: 2,
    elderExtraLives: 1,
  },
  defaultRevealRoleOnDeath: true,
};

/**
 * The most of each role the rules can handle, whatever a config says. One cupid: the rules
 * know a single pair of lovers.
 */
const ROLE_CEILING: Record<SpecialRoleId, number> = {
  werewolf: MAX_PLAYERS,
  alphaWerewolf: MAX_PLAYERS,
  seer: MAX_PLAYERS,
  bodyguard: MAX_PLAYERS,
  witch: MAX_PLAYERS,
  hunter: MAX_PLAYERS,
  cupid: 1,
  elder: MAX_PLAYERS,
  idiot: MAX_PLAYERS,
};
const MAX_ALPHA_VOTE_WEIGHT = 5;
const MAX_ELDER_EXTRA_LIVES = 3;

export const PLAYER_COUNTS: readonly number[] = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, index) => MIN_PLAYERS + index,
);

export type CompositionResult =
  | { ok: true; roleCounts: RoleCounts }
  | { ok: false; code: CompositionCode; message: string; role?: SpecialRoleId };

function emptySpecialRoles(): SpecialRoleCounts {
  return {
    werewolf: 0,
    alphaWerewolf: 0,
    seer: 0,
    bodyguard: 0,
    witch: 0,
    hunter: 0,
    cupid: 0,
    elder: 0,
    idiot: 0,
  };
}

/** A full count per special role, with the ones not named at zero. */
export function fillSpecialRoles(roles: Partial<SpecialRoleCounts>): SpecialRoleCounts {
  const filled = emptySpecialRoles();
  for (const role of SPECIAL_ROLE_IDS) filled[role] = roles[role] ?? 0;
  return filled;
}

/**
 * Whether a cast of special roles can be played by this many players, and the full cast if
 * so: villagers take every seat the special roles leave. The lobby form and the engine both
 * ask here, so they cannot disagree.
 */
export function checkComposition(
  roles: Partial<SpecialRoleCounts>,
  playerCount: number,
  config: WerewolfConfig,
): CompositionResult {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    return {
      ok: false,
      code: CompositionCodes.InvalidPlayerCount,
      message: `Werewolf needs ${MIN_PLAYERS} to ${MAX_PLAYERS} players.`,
    };
  }

  const special = fillSpecialRoles(roles);
  for (const role of SPECIAL_ROLE_IDS) {
    const limit = config.roles[role];
    if (special[role] > 0 && !limit.enabled) {
      return {
        ok: false,
        code: CompositionCodes.RoleDisabled,
        message: `The ${role} role is not available.`,
        role,
      };
    }
    if (special[role] > limit.max) {
      return {
        ok: false,
        code: CompositionCodes.RoleOverLimit,
        message: `There can be at most ${limit.max} of the ${role} role.`,
        role,
      };
    }
  }

  const wolves = countWolves(special);
  if (wolves === 0) {
    return {
      ok: false,
      code: CompositionCodes.NoWerewolf,
      message: 'A match needs at least one werewolf.',
    };
  }
  const total = SPECIAL_ROLE_IDS.reduce((sum, role) => sum + special[role], 0);
  if (total > playerCount) {
    return {
      ok: false,
      code: CompositionCodes.TooManyRoles,
      message: `${total} roles were picked for ${playerCount} players.`,
    };
  }
  if (wolves * 2 >= playerCount) {
    return {
      ok: false,
      code: CompositionCodes.TooManyWerewolves,
      message: 'The werewolves must start outnumbered by everyone else.',
    };
  }

  return { ok: true, roleCounts: { villager: playerCount - total, ...special } };
}

/** The special roles a room's settings put in play for this many players. */
export function selectedRoles(
  settings: WerewolfSettings,
  playerCount: number,
  config: WerewolfConfig,
): SpecialRoleCounts {
  if (settings.preset === 'custom' && settings.roles) return fillSpecialRoles(settings.roles);
  return fillSpecialRoles(config.presets[String(playerCount)] ?? {});
}

/** The cast a room's settings give this many players, or why they cannot play it. */
export function resolveRoles(
  settings: WerewolfSettings,
  playerCount: number,
  config: WerewolfConfig,
): CompositionResult {
  return checkComposition(selectedRoles(settings, playerCount, config), playerCount, config);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * No settings means the recommended cast. A custom cast is checked against the config's
 * limits here; whether it fits the table is only known once the players are seated, which
 * is `validateSetup`'s job.
 */
export function parseSettings(
  raw: unknown,
  config: WerewolfConfig,
): ParseSettingsResult<WerewolfSettings> {
  const defaults: WerewolfSettings = {
    preset: 'recommended',
    revealRoleOnDeath: config.defaultRevealRoleOnDeath,
  };
  if (raw === undefined || raw === null) return { ok: true, settings: defaults };
  if (!isRecord(raw)) return { ok: false, message: 'Settings must be an object.' };

  const revealRoleOnDeath = raw.revealRoleOnDeath ?? defaults.revealRoleOnDeath;
  if (typeof revealRoleOnDeath !== 'boolean') {
    return { ok: false, message: 'revealRoleOnDeath must be true or false.' };
  }
  const preset = raw.preset ?? defaults.preset;
  if (preset === 'recommended') return { ok: true, settings: { preset, revealRoleOnDeath } };
  if (preset !== 'custom') {
    return { ok: false, message: "preset must be 'recommended' or 'custom'." };
  }

  if (!isRecord(raw.roles)) return { ok: false, message: 'A custom cast needs its roles.' };
  const roles = emptySpecialRoles();
  for (const role of SPECIAL_ROLE_IDS) {
    const count = raw.roles[role] ?? 0;
    if (!Number.isInteger(count) || (count as number) < 0) {
      return { ok: false, message: `roles.${role} must be a whole number, zero or more.` };
    }
    roles[role] = count as number;
  }
  // The largest table is the most forgiving one: what fails there fails everywhere.
  const check = checkComposition(roles, MAX_PLAYERS, config);
  if (!check.ok) return { ok: false, message: check.message };

  return { ok: true, settings: { preset, roles, revealRoleOnDeath } };
}

/** Thrown inside the parser and turned into a ParseConfigResult at its edge. */
class ConfigError extends Error {}

function fail(message: string): never {
  throw new ConfigError(message);
}

function parseInteger(value: unknown, what: string, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    fail(`${what} must be an integer from ${min} to ${max}.`);
  }
  return value as number;
}

function parseBoolean(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') fail(`${what} must be true or false.`);
  return value;
}

function parseRoleLimits(raw: unknown): Record<SpecialRoleId, RoleLimit> {
  if (!isRecord(raw)) fail('roles must be an object.');
  const parseOne = (role: SpecialRoleId): RoleLimit => {
    const limit = raw[role];
    if (!isRecord(limit)) fail(`roles.${role} must be an object.`);
    return {
      enabled: parseBoolean(limit.enabled, `roles.${role}.enabled`),
      max: parseInteger(limit.max, `roles.${role}.max`, 0, ROLE_CEILING[role]),
    };
  };
  return {
    werewolf: parseOne('werewolf'),
    alphaWerewolf: parseOne('alphaWerewolf'),
    seer: parseOne('seer'),
    bodyguard: parseOne('bodyguard'),
    witch: parseOne('witch'),
    hunter: parseOne('hunter'),
    cupid: parseOne('cupid'),
    elder: parseOne('elder'),
    idiot: parseOne('idiot'),
  };
}

function parsePresets(raw: unknown): Record<string, Partial<SpecialRoleCounts>> {
  if (!isRecord(raw)) fail('presets must be an object.');
  const presets: Record<string, Partial<SpecialRoleCounts>> = {};
  for (const playerCount of PLAYER_COUNTS) {
    const at = `presets.${playerCount}`;
    const preset = raw[String(playerCount)];
    if (!isRecord(preset)) fail(`${at} must be an object.`);
    const roles: Partial<SpecialRoleCounts> = {};
    for (const role of SPECIAL_ROLE_IDS) {
      const count = parseInteger(preset[role] ?? 0, `${at}.${role}`, 0, MAX_PLAYERS);
      if (count > 0) roles[role] = count;
    }
    presets[String(playerCount)] = roles;
  }
  return presets;
}

function parseRules(raw: unknown): WerewolfRules {
  if (!isRecord(raw)) fail('rules must be an object.');
  return {
    guardCanProtectSelf: parseBoolean(raw.guardCanProtectSelf, 'rules.guardCanProtectSelf'),
    witchCanHealSelf: parseBoolean(raw.witchCanHealSelf, 'rules.witchCanHealSelf'),
    alphaVoteWeight: parseInteger(
      raw.alphaVoteWeight,
      'rules.alphaVoteWeight',
      1,
      MAX_ALPHA_VOTE_WEIGHT,
    ),
    elderExtraLives: parseInteger(
      raw.elderExtraLives,
      'rules.elderExtraLives',
      0,
      MAX_ELDER_EXTRA_LIVES,
    ),
  };
}

/**
 * Validates a config from an untrusted source and returns a clean copy holding only known
 * fields. Anything accepted here must be playable to the end by the engine: in particular a
 * room left on the recommended cast has to be able to start at every table size.
 */
export function parseConfig(raw: unknown): ParseConfigResult<WerewolfConfig> {
  try {
    if (!isRecord(raw)) fail('Config must be an object.');
    const config: WerewolfConfig = {
      roles: parseRoleLimits(raw.roles),
      presets: parsePresets(raw.presets),
      rules: parseRules(raw.rules),
      defaultRevealRoleOnDeath: parseBoolean(
        raw.defaultRevealRoleOnDeath,
        'defaultRevealRoleOnDeath',
      ),
    };

    for (const playerCount of PLAYER_COUNTS) {
      const check = checkComposition(
        config.presets[String(playerCount)] ?? {},
        playerCount,
        config,
      );
      if (!check.ok) fail(`presets.${playerCount} cannot be played: ${check.message}`);
    }
    return { ok: true, config };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, message: error.message };
    throw error;
  }
}

/** The roles of a cast in a fixed order, one entry per seat, ready to be shuffled. */
export function listRoles(roleCounts: RoleCounts): RoleId[] {
  return ROLE_IDS.flatMap((role) => Array.from({ length: roleCounts[role] }, () => role));
}
