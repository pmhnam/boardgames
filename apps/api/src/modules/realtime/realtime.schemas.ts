import { z } from 'zod';

/** Transport-level shapes only. The action payload itself is parsed by the game's engine. */
export const roomSubscriptionSchema = z.object({ roomId: z.uuid() });

export const gameSyncSchema = z.object({ gameId: z.uuid() });

export const gameActionSchema = z.object({
  gameId: z.uuid(),
  requestId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  action: z.looseObject({ type: z.string().min(1) }),
});
