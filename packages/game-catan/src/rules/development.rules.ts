import type { GameValidationResult } from '@bgp/game-core';
import { INVENTION_CARDS } from '../domain/config.js';
import type { PlayableCardType } from '../domain/development-cards.js';
import { CatanRuleCodes, VALID, invalid } from '../domain/errors.js';
import {
  countResources,
  emptyResources,
  hasResources,
  type Resource,
} from '../domain/resources.js';
import type { CatanState } from '../domain/state.js';
import { getPiecesLeft, listRoadSites } from './placement.rules.js';
import { getPlayer, validateStep } from './turn.rules.js';

const PLAYABLE_TYPES: PlayableCardType[] = ['knight', 'roadBuilding', 'invention', 'monopoly'];

/** A card bought on an earlier turn. One bought this turn has to wait. */
function holdsPlayable(state: CatanState, playerId: string, type: PlayableCardType): boolean {
  return getPlayer(state, playerId).developmentCards.some(
    (card) => card.type === type && card.boughtOnTurn < state.turn.number,
  );
}

/** Whether a card's effect could do anything at all right now. */
function hasEffect(state: CatanState, playerId: string, type: PlayableCardType): boolean {
  switch (type) {
    case 'roadBuilding':
      return getPiecesLeft(state, playerId).roads > 0 && listRoadSites(state, playerId).length > 0;
    case 'invention':
      return countResources(state.supply) >= INVENTION_CARDS;
    default:
      return true;
  }
}

/** One development card a turn, before or after the roll, never on the turn it was bought. */
export function validatePlayCard(
  state: CatanState,
  playerId: string,
  type: PlayableCardType,
): GameValidationResult {
  const step = validateStep(state, 'ROLL', 'MAIN');
  if (!step.valid) return step;
  if (state.turn.developmentCardPlayed) {
    return invalid(
      CatanRuleCodes.CardNotPlayable,
      'You have already played a development card this turn.',
    );
  }
  if (!holdsPlayable(state, playerId, type)) {
    return invalid(
      CatanRuleCodes.CardNotPlayable,
      'You do not hold that card, or you bought it this turn.',
    );
  }
  if (!hasEffect(state, playerId, type)) {
    return invalid(CatanRuleCodes.CardNotPlayable, 'That card would do nothing right now.');
  }
  return VALID;
}

export function listPlayableCards(state: CatanState, playerId: string): PlayableCardType[] {
  return PLAYABLE_TYPES.filter((type) => validatePlayCard(state, playerId, type).valid);
}

export function validateInvention(
  state: CatanState,
  playerId: string,
  picks: readonly Resource[],
): GameValidationResult {
  const playable = validatePlayCard(state, playerId, 'invention');
  if (!playable.valid) return playable;

  const wanted = emptyResources();
  for (const resource of picks) wanted[resource] += 1;
  if (!hasResources(state.supply, wanted)) {
    return invalid(CatanRuleCodes.SupplyShort, 'The supply does not have those cards.');
  }
  return VALID;
}
