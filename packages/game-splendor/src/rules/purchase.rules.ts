import {
  GEM_COLORS,
  emptyGems,
  emptyTokens,
  type GemCounts,
  type TokenCounts,
} from '../domain/gems.js';

/** What a player pays with: tokens in hand, and the bonuses of the cards already bought. */
export interface Wallet {
  tokens: TokenCounts;
  bonuses: GemCounts;
}

/** How far a player is from affording a card. */
export interface CardShortfall {
  /** Gems of each colour still needed once bonuses and tokens of that colour are counted. */
  missing: GemCounts;
  /** What is still missing after gold has covered all it can. Zero means the card is affordable. */
  short: number;
}

/** What the player owes in tokens for each colour, once bonuses are taken off the cost. */
function getOwed(wallet: Wallet, cost: Readonly<GemCounts>, color: keyof GemCounts): number {
  return Math.max(0, cost[color] - wallet.bonuses[color]);
}

export function getShortfall(wallet: Wallet, cost: Readonly<GemCounts>): CardShortfall {
  const missing = emptyGems();
  let total = 0;
  for (const color of GEM_COLORS) {
    missing[color] = Math.max(0, getOwed(wallet, cost, color) - wallet.tokens[color]);
    total += missing[color];
  }
  return { missing, short: Math.max(0, total - wallet.tokens.gold) };
}

/**
 * The tokens a purchase takes from the player, or null if they cannot afford it. Bonuses come
 * off the cost first, then gems of the right colour, and gold only covers what is still short.
 */
export function getPayment(wallet: Wallet, cost: Readonly<GemCounts>): TokenCounts | null {
  const { missing, short } = getShortfall(wallet, cost);
  if (short > 0) return null;
  const payment = emptyTokens();
  for (const color of GEM_COLORS) {
    payment[color] = getOwed(wallet, cost, color) - missing[color];
    payment.gold += missing[color];
  }
  return payment;
}

export function canAfford(wallet: Wallet, cost: Readonly<GemCounts>): boolean {
  return getShortfall(wallet, cost).short === 0;
}
