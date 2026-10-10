import { z } from 'zod';

/** Query strings arrive as text, so numbers are coerced before they are checked. */
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

export const matchListQuerySchema = pageQuerySchema.extend({
  gameType: z.string().trim().min(1).max(64).optional(),
  status: z.enum(['playing', 'finished', 'abandoned']).optional(),
});
export type MatchListQuery = z.infer<typeof matchListQuerySchema>;

/** Free text someone typed into a search box. */
const search = z.string().trim().min(1).max(64).optional();

export const roomListQuerySchema = pageQuerySchema.extend({
  gameType: z.string().trim().min(1).max(64).optional(),
  status: z.enum(['open', 'in_match', 'closed']).optional(),
  q: search,
});
export type RoomListQuery = z.infer<typeof roomListQuerySchema>;

export const userListQuerySchema = pageQuerySchema.extend({
  q: search,
  /** `true` lists computer players along with people. */
  bots: z.enum(['true', 'false']).default('false'),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

export const setDisabledSchema = z.object({ disabled: z.boolean() });

const note = z.string().trim().max(500).optional();
const expectedVersion = z.number().int().min(1);

/** The envelope only. What goes inside `config` is the game engine's business. */
export const validateConfigSchema = z.object({ config: z.unknown() });

export const publishConfigSchema = z.object({ config: z.unknown(), note, expectedVersion });

export const restoreConfigSchema = z.object({ note, expectedVersion });
