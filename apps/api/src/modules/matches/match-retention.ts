import { eq, gt, or, sql } from 'drizzle-orm';
import { matches } from '../../infrastructure/database/schema.js';

export const MATCH_HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;

/** Unfinished matches never expire. Legacy abandoned matches use creation time as a fallback. */
export function retainedMatch(now = new Date()) {
  return or(
    eq(matches.status, 'playing'),
    gt(
      sql`coalesce(${matches.finishedAt}, ${matches.createdAt})`,
      new Date(now.getTime() - MATCH_HISTORY_RETENTION_MS),
    ),
  );
}
