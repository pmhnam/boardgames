/** The languages the interface is written in. The first is the fallback. */
export const LOCALES = ['vi', 'en'] as const;

export type Locale = (typeof LOCALES)[number];
