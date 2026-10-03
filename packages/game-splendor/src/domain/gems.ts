export const GEM_COLORS = ['white', 'blue', 'green', 'red', 'black'] as const;

/** The five colours a card can cost and give as a bonus. */
export type GemColor = (typeof GEM_COLORS)[number];

export const GOLD = 'gold';

export const TOKEN_COLORS = [...GEM_COLORS, GOLD] as const;

/** A token a player can hold: a gem, or gold, which stands in for any gem when buying. */
export type TokenColor = (typeof TOKEN_COLORS)[number];

export type GemCounts = Record<GemColor, number>;
export type TokenCounts = Record<TokenColor, number>;

export function isGemColor(value: unknown): value is GemColor {
  return typeof value === 'string' && (GEM_COLORS as readonly string[]).includes(value);
}

export function emptyGems(): GemCounts {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0 };
}

export function emptyTokens(): TokenCounts {
  return { ...emptyGems(), gold: 0 };
}

export function countTokens(tokens: Readonly<Partial<TokenCounts>>): number {
  return TOKEN_COLORS.reduce((sum, color) => sum + (tokens[color] ?? 0), 0);
}

export function addTokens(
  tokens: Readonly<TokenCounts>,
  delta: Readonly<Partial<TokenCounts>>,
  sign: 1 | -1 = 1,
): TokenCounts {
  const result = { ...tokens };
  for (const color of TOKEN_COLORS) result[color] += sign * (delta[color] ?? 0);
  return result;
}
