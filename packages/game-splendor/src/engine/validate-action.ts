import type { GameActionContext, GameValidationResult } from '@bgp/game-core';
import type { SplendorAction } from '../domain/actions.js';
import { getCard } from '../domain/cards.js';
import { SplendorRuleCodes } from '../domain/errors.js';
import type { SplendorState } from '../domain/state.js';
import { validateReturnGems, validateTakeGems } from '../rules/gems.rules.js';
import {
  getLegalMoves,
  getNobleChoices,
  getPurchaseSources,
  getWallet,
} from '../rules/legal-moves.js';
import { canAfford } from '../rules/purchase.rules.js';
import {
  CARD_NOT_AVAILABLE,
  validateReserveCard,
  validateReserveFromDeck,
} from '../rules/reserve.rules.js';
import { getPlayer, validateCanAct, validateStep } from '../rules/turn.rules.js';

function validateBuyCard(
  state: SplendorState,
  playerId: string,
  cardId: string,
): GameValidationResult {
  // Availability first: what a player cannot afford must not reveal what exists elsewhere.
  if (!getPurchaseSources(state, playerId).includes(cardId)) return CARD_NOT_AVAILABLE;
  if (!canAfford(getWallet(state, playerId), getCard(state.config.cards, cardId).cost)) {
    return {
      valid: false,
      code: SplendorRuleCodes.CannotAfford,
      message: 'You cannot afford that card.',
    };
  }
  return { valid: true };
}

function validateChooseNoble(
  state: SplendorState,
  playerId: string,
  nobleId: string,
): GameValidationResult {
  if (!getNobleChoices(state, playerId).some((noble) => noble.id === nobleId)) {
    return {
      valid: false,
      code: SplendorRuleCodes.NobleNotEligible,
      message: 'That noble is not ready to visit you.',
    };
  }
  return { valid: true };
}

function validatePass(state: SplendorState, playerId: string): GameValidationResult {
  if (!getLegalMoves(state, playerId).canPass) {
    return {
      valid: false,
      code: SplendorRuleCodes.PassNotAllowed,
      message: 'You may only pass when you have no other move.',
    };
  }
  return { valid: true };
}

export function validateAction(
  state: SplendorState,
  action: SplendorAction,
  context: GameActionContext,
): GameValidationResult {
  const playerId = context.actorPlayerId;
  const canAct = validateCanAct(state, playerId);
  if (!canAct.valid) return canAct;

  const step = validateStep(
    state,
    action.type === 'RETURN_GEMS'
      ? 'RETURN_GEMS'
      : action.type === 'CHOOSE_NOBLE'
        ? 'CHOOSE_NOBLE'
        : 'ACTION',
  );
  if (!step.valid) return step;

  const player = getPlayer(state, playerId);
  switch (action.type) {
    case 'TAKE_GEMS':
      return validateTakeGems(state.bank, action.colors);
    case 'RESERVE_CARD':
      return validateReserveCard(state, player, action.cardId);
    case 'RESERVE_FROM_DECK':
      return validateReserveFromDeck(state, player, action.tier);
    case 'BUY_CARD':
      return validateBuyCard(state, playerId, action.cardId);
    case 'RETURN_GEMS':
      return validateReturnGems(player.tokens, action.tokens);
    case 'CHOOSE_NOBLE':
      return validateChooseNoble(state, playerId, action.nobleId);
    case 'PASS':
      return validatePass(state, playerId);
  }
}
