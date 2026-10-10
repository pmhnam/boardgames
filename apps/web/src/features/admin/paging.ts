export interface ListParams {
  limit: number;
  offset: number;
}

export const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function readInt(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/** Paging from the address bar. Anything the server would refuse falls back to the default. */
export function parseListParams(params: URLSearchParams, pageSize = DEFAULT_PAGE_SIZE): ListParams {
  const limit = readInt(params.get('limit'));
  const offset = readInt(params.get('offset'));
  return {
    limit: limit !== null && limit >= 1 && limit <= MAX_PAGE_SIZE ? limit : pageSize,
    offset: offset ?? 0,
  };
}

export interface PageInfo {
  /** 1-based position of the first and last row shown; both 0 when there are no rows. */
  from: number;
  to: number;
  total: number;
  /** Offsets to move to, or null at either end. */
  previousOffset: number | null;
  nextOffset: number | null;
}

export function pageInfo(page: {
  total: number;
  limit: number;
  offset: number;
  shown: number;
}): PageInfo {
  const { total, limit, offset, shown } = page;
  return {
    from: shown === 0 ? 0 : offset + 1,
    to: offset + shown,
    total,
    previousOffset: offset > 0 ? Math.max(0, offset - limit) : null,
    nextOffset: offset + shown < total ? offset + limit : null,
  };
}

/** A query string from a list's filters and page, leaving out what is not set. */
export function toQuery(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text === '' ? '' : `?${text}`;
}

/**
 * The address bar after a filter or page change. Changing a filter goes back to the first
 * page: the row someone was looking at is not at the same offset in a different list.
 */
export function withListChange(
  current: URLSearchParams,
  changes: Record<string, string | number | null>,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (!('offset' in changes)) next.delete('offset');
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '' || (key === 'offset' && value === 0)) next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}
