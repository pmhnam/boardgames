import {
  bigint,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

/** Raw engine state: always a JSON object, otherwise opaque to the platform. */
export type OpaqueGameState = Record<string, unknown>;

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: createdAt(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only. Each row is one complete, validated configuration of a game; the highest
 * version per game is the one new matches are set up with.
 */
export const gameConfigs = pgTable(
  'game_configs',
  {
    gameType: text('game_type').notNull(),
    version: integer('version').notNull(),
    /** Shaped by the game's engine; opaque to the platform. */
    config: jsonb('config').$type<unknown>().notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.gameType, table.version] })],
);

export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey(),
  code: text('code').notNull().unique(),
  gameType: text('game_type').notNull(),
  hostUserId: uuid('host_user_id')
    .notNull()
    .references(() => users.id),
  status: text('status').$type<'open' | 'in_match' | 'closed'>().notNull(),
  visibility: text('visibility').$type<'private' | 'public'>().notNull(),
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

export const roomMembers = pgTable(
  'room_members',
  {
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    seat: integer('seat').notNull(),
    status: text('status').$type<'joined' | 'ready'>().notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.userId] }),
    unique('room_members_room_seat_unique').on(table.roomId, table.seat),
  ],
);

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey(),
  roomId: uuid('room_id')
    .notNull()
    .references(() => rooms.id),
  gameType: text('game_type').notNull(),
  engineVersion: integer('engine_version').notNull(),
  /** The room settings this match was set up with, as validated at the time. */
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  /** Which game_configs version this match was set up with. */
  configVersion: integer('config_version').notNull().default(1),
  status: text('status').$type<'playing' | 'finished' | 'abandoned'>().notNull(),
  /** Never sent to clients as-is. */
  state: jsonb('state').$type<OpaqueGameState>().notNull(),
  stateVersion: bigint('state_version', { mode: 'number' }).notNull().default(0),
  randomSeed: text('random_seed').notNull(),
  result: jsonb('result').$type<{ winnerPlayerIds: string[]; scores?: Record<string, number> }>(),
  createdAt: createdAt(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

export const matchPlayers = pgTable(
  'match_players',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    playerId: text('player_id').notNull(),
    seat: integer('seat').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.playerId] }),
    unique('match_players_match_user_unique').on(table.matchId, table.userId),
  ],
);

export const matchActions = pgTable(
  'match_actions',
  {
    id: uuid('id').primaryKey(),
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    sequence: bigint('sequence', { mode: 'number' }).notNull(),
    playerId: text('player_id').notNull(),
    actionType: text('action_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    requestId: text('request_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique('match_actions_match_sequence_unique').on(table.matchId, table.sequence),
    unique('match_actions_match_request_unique').on(table.matchId, table.requestId),
  ],
);
