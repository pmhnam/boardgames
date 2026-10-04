export type MessageParams = Record<string, string | number>;

/** Fills `{name}` placeholders. One with no matching param is left as written. */
export function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

/** Which of `supported` a browser asking for `preferred` gets. The first is the fallback. */
export function pickLocale<T extends string>(
  supported: readonly [T, ...T[]],
  preferred: readonly string[],
): T {
  for (const tag of preferred) {
    const language = tag.toLowerCase().split('-')[0];
    const match = supported.find((locale) => locale === language);
    if (match) return match;
  }
  return supported[0];
}
