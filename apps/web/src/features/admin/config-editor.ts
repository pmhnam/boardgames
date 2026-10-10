/** What the admin types into the config editor: JSON text that may not parse yet. */
export type ParsedDraft = { ok: true; value: unknown } | { ok: false; message: string };

export function parseDraft(text: string): ParsedDraft {
  if (text.trim() === '') return { ok: false, message: 'empty' };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

export function formatDraft(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Re-indents the draft. Text that does not parse is returned untouched, not thrown away. */
export function reformat(text: string): string {
  const parsed = parseDraft(text);
  return parsed.ok ? formatDraft(parsed.value) : text;
}

/** Same document: key order and whitespace do not count, array order does. */
export function sameDocument(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => sameDocument(item, b[index]))
    );
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => key in right && sameDocument(left[key], right[key]))
  );
}

/** Why the draft cannot be published as it stands, or null when it can. */
export type PublishBlocker = 'invalid-json' | 'unchanged' | null;

export function publishBlocker(text: string, current: unknown): PublishBlocker {
  const parsed = parseDraft(text);
  if (!parsed.ok) return 'invalid-json';
  return sameDocument(parsed.value, current) ? 'unchanged' : null;
}
