import { describe, expect, it } from 'vitest';
import { pageInfo, parseListParams, toQuery, withListChange } from './paging';

describe('parseListParams', () => {
  it('reads the page from the address bar', () => {
    expect(parseListParams(new URLSearchParams('limit=10&offset=30'))).toEqual({
      limit: 10,
      offset: 30,
    });
  });

  it('falls back to the first page of the default size', () => {
    expect(parseListParams(new URLSearchParams(''))).toEqual({ limit: 25, offset: 0 });
    expect(parseListParams(new URLSearchParams(''), 10)).toEqual({ limit: 10, offset: 0 });
  });

  it('ignores values the server would refuse', () => {
    for (const query of ['limit=0', 'limit=101', 'limit=abc', 'limit=-5', 'limit=2.5']) {
      expect(parseListParams(new URLSearchParams(query)).limit).toBe(25);
    }
    for (const query of ['offset=-1', 'offset=x', 'offset=1e3']) {
      expect(parseListParams(new URLSearchParams(query)).offset).toBe(0);
    }
  });
});

describe('pageInfo', () => {
  it('describes a page in the middle', () => {
    expect(pageInfo({ total: 60, limit: 25, offset: 25, shown: 25 })).toEqual({
      from: 26,
      to: 50,
      total: 60,
      previousOffset: 0,
      nextOffset: 50,
    });
  });

  it('has no previous page at the start and no next page at the end', () => {
    expect(pageInfo({ total: 60, limit: 25, offset: 0, shown: 25 }).previousOffset).toBeNull();
    expect(pageInfo({ total: 60, limit: 25, offset: 50, shown: 10 })).toMatchObject({
      from: 51,
      to: 60,
      nextOffset: null,
    });
  });

  it('steps back to the start from an offset that is not a multiple of the page size', () => {
    expect(pageInfo({ total: 60, limit: 25, offset: 10, shown: 25 }).previousOffset).toBe(0);
  });

  it('shows nothing as nothing, with a way back from beyond the last row', () => {
    expect(pageInfo({ total: 0, limit: 25, offset: 0, shown: 0 })).toEqual({
      from: 0,
      to: 0,
      total: 0,
      previousOffset: null,
      nextOffset: null,
    });
    expect(pageInfo({ total: 3, limit: 25, offset: 50, shown: 0 })).toMatchObject({
      from: 0,
      previousOffset: 25,
      nextOffset: null,
    });
  });
});

describe('toQuery', () => {
  it('builds a query string from what is set', () => {
    expect(toQuery({ gameType: 'splendor', status: '', q: null, limit: 25, offset: 0 })).toBe(
      '?gameType=splendor&limit=25&offset=0',
    );
  });

  it('is empty when nothing is set, and encodes what people type', () => {
    expect(toQuery({ q: undefined })).toBe('');
    expect(toQuery({ q: 'a&b c' })).toBe('?q=a%26b+c');
  });
});

describe('withListChange', () => {
  it('goes back to the first page when a filter changes', () => {
    const next = withListChange(new URLSearchParams('status=playing&offset=50'), {
      status: 'finished',
    });
    expect(next.toString()).toBe('status=finished');
  });

  it('keeps the filters when only the page changes', () => {
    const next = withListChange(new URLSearchParams('status=playing'), { offset: 25 });
    expect(next.toString()).toBe('status=playing&offset=25');
  });

  it('drops a cleared filter and the first page from the address', () => {
    expect(withListChange(new URLSearchParams('status=playing&q=x'), { q: '' }).toString()).toBe(
      'status=playing',
    );
    expect(withListChange(new URLSearchParams('offset=25'), { offset: 0 }).toString()).toBe('');
  });
});
