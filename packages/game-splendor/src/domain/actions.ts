import type { Tier } from './cards.js';
import type { GemColor, TokenCounts } from './gems.js';

/** Three different colours, or the same colour twice. Fewer only when the bank runs short. */
export interface TakeGemsAction {
  type: 'TAKE_GEMS';
  colors: GemColor[];
}

/** Reserve a face-up card. */
export interface ReserveCardAction {
  type: 'RESERVE_CARD';
  cardId: string;
}

/** Reserve the unseen top card of a deck. The payload never names the card. */
export interface ReserveFromDeckAction {
  type: 'RESERVE_FROM_DECK';
  tier: Tier;
}

/** Buy a face-up card or one of the player's own reserved cards. Payment is worked out. */
export interface BuyCardAction {
  type: 'BUY_CARD';
  cardId: string;
}

/** Give back the tokens held over the limit. */
export interface ReturnGemsAction {
  type: 'RETURN_GEMS';
  tokens: Partial<TokenCounts>;
}

/** Pick which noble visits, when more than one could. */
export interface ChooseNobleAction {
  type: 'CHOOSE_NOBLE';
  nobleId: string;
}

/** Only legal when the player can do nothing else. */
export interface PassAction {
  type: 'PASS';
}

export type SplendorAction =
  | TakeGemsAction
  | ReserveCardAction
  | ReserveFromDeckAction
  | BuyCardAction
  | ReturnGemsAction
  | ChooseNobleAction
  | PassAction;
