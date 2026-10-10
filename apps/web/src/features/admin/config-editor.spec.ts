import { describe, expect, it } from 'vitest';
import { formatDraft, parseDraft, publishBlocker, reformat, sameDocument } from './config-editor';

describe('parseDraft', () => {
  it('reads JSON of any shape', () => {
    expect(parseDraft('{"size": 5}')).toEqual({ ok: true, value: { size: 5 } });
    expect(parseDraft('[1, 2]')).toEqual({ ok: true, value: [1, 2] });
  });

  it('says what is wrong with text that is not JSON, without throwing', () => {
    const broken = parseDraft('{"size": 5,}');
    expect(broken.ok).toBe(false);
    expect(broken.ok ? '' : broken.message).not.toBe('');
    expect(parseDraft('   ').ok).toBe(false);
  });
});

describe('reformat', () => {
  it('re-indents a draft the way a loaded config is shown', () => {
    expect(reformat('{"a":1,"b":[1,2]}')).toBe(formatDraft({ a: 1, b: [1, 2] }));
  });

  it('leaves a draft that does not parse exactly as typed', () => {
    expect(reformat('{"a":')).toBe('{"a":');
  });
});

describe('sameDocument', () => {
  it('ignores key order and formatting', () => {
    expect(
      sameDocument({ a: 1, b: { c: [1, 2], d: null } }, { b: { d: null, c: [1, 2] }, a: 1 }),
    ).toBe(true);
  });

  it('notices a changed value, a missing key, an extra key and a reordered list', () => {
    const base = { a: 1, list: [1, 2] };
    expect(sameDocument(base, { a: 2, list: [1, 2] })).toBe(false);
    expect(sameDocument(base, { list: [1, 2] })).toBe(false);
    expect(sameDocument(base, { a: 1, list: [1, 2], extra: undefined })).toBe(false);
    expect(sameDocument(base, { a: 1, list: [2, 1] })).toBe(false);
  });

  it('does not confuse null, arrays and objects', () => {
    expect(sameDocument(null, {})).toBe(false);
    expect(sameDocument([], {})).toBe(false);
    expect(sameDocument({ a: null }, { a: {} })).toBe(false);
    expect(sameDocument(0, false)).toBe(false);
  });
});

describe('publishBlocker', () => {
  const current = { boardSize: 5, targetScore: 8 };

  it('blocks text that is not JSON', () => {
    expect(publishBlocker('{"boardSize": ', current)).toBe('invalid-json');
  });

  it('blocks a draft that says the same as the config in force', () => {
    expect(publishBlocker('{ "targetScore": 8,\n  "boardSize": 5 }', current)).toBe('unchanged');
  });

  it('lets a real change through', () => {
    expect(publishBlocker('{"boardSize": 4, "targetScore": 8}', current)).toBeNull();
  });
});
