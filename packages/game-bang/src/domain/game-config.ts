import type { ParseConfigResult, ParseSettingsResult } from '@bgp/game-core';
import {
  CARD_KINDS,
  MAX_RANK,
  MIN_RANK,
  SUITS,
  type Card,
  type CardKind,
  type Suit,
} from './cards.js';
import { CHARACTER_IDS, type CharacterId } from './characters.js';
import { MAX_PLAYERS, MIN_PLAYERS } from './config.js';
import { DEFAULT_CARDS } from './default-deck.js';
import type { OtherRoleCounts, RoleCounts, RoleId } from './roles.js';

export interface CharacterConfig {
  /** Whether the character can be dealt at all. */
  enabled: boolean;
  /** Life points, before the sheriff's bonus. Also the size of the hand they may keep. */
  life: number;
}

/** The numbers of the rules an operator can tune. */
export interface BangRules {
  /** Extra life points for whoever is dealt the sheriff. */
  sheriffBonusLife: number;
  /** BANG! cards a player may play in a turn without a Volcanic. */
  bangsPerTurn: number;
  /** Cards drawn for eliminating an outlaw. */
  outlawBounty: number;
  dynamiteDamage: number;
  /** A beer heals only while at least this many players are alive. */
  beerMinPlayers: number;
}

/** Everything about BANG! that can change without changing its rules. */
export interface BangConfig {
  /** The playing cards, one entry per physical card. */
  cards: Card[];
  characters: Record<CharacterId, CharacterConfig>;
  /** Who is dealt besides the sheriff, keyed by player count. */
  roles: Record<string, OtherRoleCounts>;
  rules: BangRules;
}

/** Nothing for a host to choose yet. */
export type BangSettings = Record<string, never>;

/**
 * The config as one match plays it. This is what a match keeps in its state, so it is
 * unaffected by later config changes.
 */
export interface BangSetup {
  rules: BangRules;
  /** The roles the match was dealt. */
  roleCounts: RoleCounts;
}

const CHARACTER_LIFE: Partial<Record<CharacterId, number>> = { elGringo: 3, paulRegret: 3 };
const DEFAULT_LIFE = 4;

export const DEFAULT_BANG_CONFIG: BangConfig = {
  cards: DEFAULT_CARDS,
  characters: Object.fromEntries(
    CHARACTER_IDS.map((id) => [id, { enabled: true, life: CHARACTER_LIFE[id] ?? DEFAULT_LIFE }]),
  ) as Record<CharacterId, CharacterConfig>,
  roles: {
    4: { deputy: 0, outlaw: 2, renegade: 1 },
    5: { deputy: 1, outlaw: 2, renegade: 1 },
    6: { deputy: 1, outlaw: 3, renegade: 1 },
    7: { deputy: 2, outlaw: 3, renegade: 1 },
  },
  rules: {
    sheriffBonusLife: 1,
    bangsPerTurn: 1,
    outlawBounty: 3,
    dynamiteDamage: 3,
    beerMinPlayers: 3,
  },
};

const MAX_LIFE = 6;
const MAX_CARDS = 300;
const MAX_BANGS_PER_TURN = 5;
const MAX_BOUNTY = 6;

export const PLAYER_COUNTS: readonly number[] = Array.from(
  { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
  (_, index) => MIN_PLAYERS + index,
);

/** The roles this many players are dealt, or null for a table size the config does not seat. */
export function getRoleCounts(config: BangConfig, playerCount: number): RoleCounts | null {
  const others = config.roles[String(playerCount)];
  if (!others) return null;
  return { sheriff: 1, deputy: others.deputy, outlaw: others.outlaw, renegade: others.renegade };
}

/** The roles of a cast in a fixed order, one entry per seat, ready to be shuffled. */
export function listRoles(roleCounts: RoleCounts): RoleId[] {
  return (Object.keys(roleCounts) as RoleId[]).flatMap((role) =>
    Array.from({ length: roleCounts[role] }, () => role),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** There is nothing to choose: any object, or nothing at all, is the one possible setting. */
export function parseSettings(raw: unknown): ParseSettingsResult<BangSettings> {
  if (raw === undefined || raw === null || isRecord(raw)) return { ok: true, settings: {} };
  return { ok: false, message: 'Settings must be an object.' };
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

function parseCards(raw: unknown): Card[] {
  if (!Array.isArray(raw)) fail('cards must be a list.');
  if (raw.length > MAX_CARDS) fail(`cards must hold at most ${MAX_CARDS} cards.`);
  return raw.map((card: unknown, index): Card => {
    const at = `cards[${index}]`;
    if (!isRecord(card)) fail(`${at} must be an object.`);
    if (!CARD_KINDS.includes(card.kind as CardKind)) fail(`${at}.kind is not a known card.`);
    if (!SUITS.includes(card.suit as Suit)) fail(`${at}.suit is not a suit.`);
    return {
      kind: card.kind as CardKind,
      suit: card.suit as Suit,
      rank: parseInteger(card.rank, `${at}.rank`, MIN_RANK, MAX_RANK),
    };
  });
}

function parseCharacters(raw: unknown): Record<CharacterId, CharacterConfig> {
  if (!isRecord(raw)) fail('characters must be an object.');
  const characters = {} as Record<CharacterId, CharacterConfig>;
  for (const id of CHARACTER_IDS) {
    const character = raw[id];
    if (!isRecord(character)) fail(`characters.${id} must be an object.`);
    if (typeof character.enabled !== 'boolean') {
      fail(`characters.${id}.enabled must be true or false.`);
    }
    characters[id] = {
      enabled: character.enabled,
      life: parseInteger(character.life, `characters.${id}.life`, 1, MAX_LIFE),
    };
  }
  return characters;
}

function parseRoles(raw: unknown): Record<string, OtherRoleCounts> {
  if (!isRecord(raw)) fail('roles must be an object.');
  const roles: Record<string, OtherRoleCounts> = {};
  for (const playerCount of PLAYER_COUNTS) {
    const at = `roles.${playerCount}`;
    const cast = raw[String(playerCount)];
    if (!isRecord(cast)) fail(`${at} must be an object.`);
    const counts: OtherRoleCounts = {
      deputy: parseInteger(cast.deputy, `${at}.deputy`, 0, MAX_PLAYERS),
      outlaw: parseInteger(cast.outlaw, `${at}.outlaw`, 0, MAX_PLAYERS),
      renegade: parseInteger(cast.renegade, `${at}.renegade`, 0, MAX_PLAYERS),
    };
    if (counts.deputy + counts.outlaw + counts.renegade + 1 !== playerCount) {
      fail(`${at} must deal a sheriff and ${playerCount - 1} other roles.`);
    }
    // With nobody against the sheriff the match would be over before it began.
    if (counts.outlaw + counts.renegade === 0) fail(`${at} needs an outlaw or a renegade.`);
    roles[String(playerCount)] = counts;
  }
  return roles;
}

function parseRules(raw: unknown): BangRules {
  if (!isRecord(raw)) fail('rules must be an object.');
  return {
    sheriffBonusLife: parseInteger(raw.sheriffBonusLife, 'rules.sheriffBonusLife', 0, MAX_LIFE),
    bangsPerTurn: parseInteger(raw.bangsPerTurn, 'rules.bangsPerTurn', 1, MAX_BANGS_PER_TURN),
    outlawBounty: parseInteger(raw.outlawBounty, 'rules.outlawBounty', 0, MAX_BOUNTY),
    dynamiteDamage: parseInteger(raw.dynamiteDamage, 'rules.dynamiteDamage', 1, MAX_LIFE),
    beerMinPlayers: parseInteger(raw.beerMinPlayers, 'rules.beerMinPlayers', 2, MAX_PLAYERS + 1),
  };
}

/**
 * Validates a config from an untrusted source and returns a clean copy holding only known
 * fields. Anything accepted here must be playable to the end by the engine: every table size
 * has roles and characters to deal, the deck covers the opening hands, and it holds a card
 * that can cost someone a life point.
 */
export function parseConfig(raw: unknown): ParseConfigResult<BangConfig> {
  try {
    if (!isRecord(raw)) fail('Config must be an object.');
    const config: BangConfig = {
      cards: parseCards(raw.cards),
      characters: parseCharacters(raw.characters),
      roles: parseRoles(raw.roles),
      rules: parseRules(raw.rules),
    };

    const dealt = CHARACTER_IDS.filter((id) => config.characters[id].enabled);
    if (dealt.length < MAX_PLAYERS) {
      fail(`At least ${MAX_PLAYERS} characters must be enabled.`);
    }
    const largestHand = Math.max(...dealt.map((id) => config.characters[id].life));
    const openingHands = MAX_PLAYERS * largestHand + config.rules.sheriffBonusLife;
    if (config.cards.length < openingHands) {
      fail(`cards must hold at least ${openingHands} cards to deal the opening hands.`);
    }
    if (!config.cards.some((card) => card.kind === 'bang')) {
      fail('cards must hold at least one bang.');
    }
    return { ok: true, config };
  } catch (error) {
    if (error instanceof ConfigError) return { ok: false, message: error.message };
    throw error;
  }
}
