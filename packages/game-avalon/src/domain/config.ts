export const AVALON_GAME_TYPE = 'avalon';
export const AVALON_ENGINE_VERSION = 1;

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;

export const PLAYER_COUNTS = [5, 6, 7, 8, 9, 10] as const;
export type PlayerCount = (typeof PLAYER_COUNTS)[number];

export const QUEST_COUNT = 5;
/** Quests one side needs to go its way. */
export const QUESTS_TO_WIN = 3;
