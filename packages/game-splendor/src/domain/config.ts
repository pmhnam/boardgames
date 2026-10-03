export const SPLENDOR_GAME_TYPE = 'splendor';
export const SPLENDOR_ENGINE_VERSION = 1;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export const PLAYER_COUNTS = [2, 3, 4] as const;
export type PlayerCount = (typeof PLAYER_COUNTS)[number];

/** Face-up cards per tier. */
export const MARKET_SIZE = 4;
/** A player holding more tokens than this at the end of their action must return the excess. */
export const TOKEN_LIMIT = 10;
export const MAX_RESERVED = 3;
/** Gems taken when taking different colours, when the bank has that many colours left. */
export const DIFFERENT_GEMS_TAKEN = 3;
/** Two gems of one colour may only be taken from a pile of at least this many. */
export const DOUBLE_TAKE_MIN_PILE = 4;
