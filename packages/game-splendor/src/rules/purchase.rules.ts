import { GEM_COLORS, emptyTokens, type GemCounts, type TokenCounts } from '../domain/gems.js';

/** What a player pays with: tokens in hand, and the bonuses of the cards already bought. */
export interface Wallet {
  tokens: TokenCounts;
  bonuses: GemCounts;
}

/**
 * The tokens a purchase takes from the player, or null if they cannot afford it. Bonuses come
 * off the cost first, then gems of the right colour, and gold only covers what is still short.
 */
export function getPayment(wallet: Wallet, cost: Readonly<GemCounts>): TokenCounts | null {
  const payment = emptyTokens();
  for (const color of GEM_COLORS) {
    const owed = Math.max(0, cost[color] - wallet.bonuses[color]);
    payment[color] = Math.min(owed, wallet.tokens[color]);
    payment.gold += owed - payment[color];
  }
  return payment.gold > wallet.tokens.gold ? null : payment;
}

export function canAfford(wallet: Wallet, cost: Readonly<GemCounts>): boolean {
  return getPayment(wallet, cost) !== null;
}
