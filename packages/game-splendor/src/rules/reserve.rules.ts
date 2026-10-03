import type { GameValidationResult } from '@bgp/game-core';
import { TIERS, type Tier } from '../domain/cards.js';
import { MAX_RESERVED } from '../domain/config.js';
import { SplendorRuleCodes } from '../domain/errors.js';
import type { PlayerState, SplendorState } from '../domain/state.js';

/**
 * One answer for every card a player may not touch: an unknown id, a card still in a deck and
 * a card in someone else's reserve must be indistinguishable, or the code would tell a client
 * what an opponent is hiding.
 */
export const CARD_NOT_AVAILABLE: GameValidationResult = {
  valid: false,
  code: SplendorRuleCodes.CardNotAvailable,
  message: 'That card is not available.',
};

export function findMarketSlot(
  market: SplendorState['market'],
  cardId: string,
): { tier: Tier; slot: number } | null {
  for (const tier of TIERS) {
    const slot = market[tier].indexOf(cardId);
    if (slot !== -1) return { tier, slot };
  }
  return null;
}

export function validateReserveLimit(player: Pick<PlayerState, 'reserved'>): GameValidationResult {
  if (player.reserved.length >= MAX_RESERVED) {
    return {
      valid: false,
      code: SplendorRuleCodes.ReserveLimitReached,
      message: `You can hold at most ${MAX_RESERVED} reserved cards.`,
    };
  }
  return { valid: true };
}

export function validateReserveCard(
  state: Pick<SplendorState, 'market'>,
  player: Pick<PlayerState, 'reserved'>,
  cardId: string,
): GameValidationResult {
  const limit = validateReserveLimit(player);
  if (!limit.valid) return limit;
  return findMarketSlot(state.market, cardId) ? { valid: true } : CARD_NOT_AVAILABLE;
}

export function validateReserveFromDeck(
  state: Pick<SplendorState, 'decks'>,
  player: Pick<PlayerState, 'reserved'>,
  tier: Tier,
): GameValidationResult {
  const limit = validateReserveLimit(player);
  if (!limit.valid) return limit;
  if (state.decks[tier].length === 0) {
    return { valid: false, code: SplendorRuleCodes.DeckEmpty, message: 'That deck is empty.' };
  }
  return { valid: true };
}
