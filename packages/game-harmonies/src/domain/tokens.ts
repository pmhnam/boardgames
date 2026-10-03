export const TOKEN_COLORS = ['water', 'mountain', 'trunk', 'leaf', 'field', 'building'] as const;

export type TokenColor = (typeof TOKEN_COLORS)[number];

/** The default pouch (120 tokens). The pouch a match uses comes from its config. */
export const DEFAULT_TOKEN_COUNTS: Readonly<Record<TokenColor, number>> = {
  water: 23,
  mountain: 23,
  trunk: 21,
  leaf: 19,
  field: 19,
  building: 15,
};

export function isTokenColor(value: unknown): value is TokenColor {
  return typeof value === 'string' && (TOKEN_COLORS as readonly string[]).includes(value);
}
