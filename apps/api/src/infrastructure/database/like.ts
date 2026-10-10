import { ilike, type Column } from 'drizzle-orm';

/**
 * Case-insensitive "contains" for text people typed. `%` and `_` in it mean themselves, not
 * "anything": a search for `50%` must not match every row.
 */
export function containsText(column: Column, text: string) {
  return ilike(column, `%${text.replace(/[\\%_]/g, '\\$&')}%`);
}
