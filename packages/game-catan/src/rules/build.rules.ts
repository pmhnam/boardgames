import type { GameValidationResult } from '@bgp/game-core';
import { CatanRuleCodes, VALID, invalid } from '../domain/errors.js';
import type { Costs, Pieces } from '../domain/game-config.js';
import { hasResources } from '../domain/resources.js';
import type { CatanState } from '../domain/state.js';
import {
  getPiecesLeft,
  validateCitySite,
  validateConnectedSettlementSite,
  validateRoadSite,
} from './placement.rules.js';
import { getPlayer, validateStep } from './turn.rules.js';

export function validateHasPiece(
  state: CatanState,
  playerId: string,
  piece: keyof Pieces,
): GameValidationResult {
  if (getPiecesLeft(state, playerId)[piece] < 1) {
    return invalid(CatanRuleCodes.NoPiecesLeft, `You have no ${piece} left.`);
  }
  return VALID;
}

export function validateCanPay(
  state: CatanState,
  playerId: string,
  item: keyof Costs,
): GameValidationResult {
  if (!hasResources(getPlayer(state, playerId).resources, state.config.costs[item])) {
    return invalid(CatanRuleCodes.CannotAfford, 'You do not have the resources for that.');
  }
  return VALID;
}

function firstInvalid(...checks: (() => GameValidationResult)[]): GameValidationResult {
  for (const check of checks) {
    const result = check();
    if (!result.valid) return result;
  }
  return VALID;
}

/** Whether a road placed now would be one of the free ones from a Road Building card. */
export function isRoadFree(state: Pick<CatanState, 'turn'>): boolean {
  return state.turn.freeRoads > 0;
}

/** Everything about building a road except where it goes. */
export function validateMayBuildRoad(state: CatanState, playerId: string): GameValidationResult {
  if (isRoadFree(state)) {
    // A Road Building card may be played before the roll, so its roads may be placed then too.
    return firstInvalid(
      () => validateStep(state, 'ROLL', 'MAIN'),
      () => validateHasPiece(state, playerId, 'roads'),
    );
  }
  return firstInvalid(
    () => validateStep(state, 'MAIN'),
    () => validateHasPiece(state, playerId, 'roads'),
    () => validateCanPay(state, playerId, 'road'),
  );
}

export function validateMayBuildSettlement(
  state: CatanState,
  playerId: string,
): GameValidationResult {
  return firstInvalid(
    () => validateStep(state, 'MAIN'),
    () => validateHasPiece(state, playerId, 'settlements'),
    () => validateCanPay(state, playerId, 'settlement'),
  );
}

export function validateMayBuildCity(state: CatanState, playerId: string): GameValidationResult {
  return firstInvalid(
    () => validateStep(state, 'MAIN'),
    () => validateHasPiece(state, playerId, 'cities'),
    () => validateCanPay(state, playerId, 'city'),
  );
}

export function validateBuildRoad(
  state: CatanState,
  playerId: string,
  edge: string,
): GameValidationResult {
  return firstInvalid(
    () => validateMayBuildRoad(state, playerId),
    () => validateRoadSite(state, playerId, edge),
  );
}

export function validateBuildSettlement(
  state: CatanState,
  playerId: string,
  vertex: string,
): GameValidationResult {
  return firstInvalid(
    () => validateMayBuildSettlement(state, playerId),
    () => validateConnectedSettlementSite(state, playerId, vertex),
  );
}

export function validateBuildCity(
  state: CatanState,
  playerId: string,
  vertex: string,
): GameValidationResult {
  return firstInvalid(
    () => validateMayBuildCity(state, playerId),
    () => validateCitySite(state, playerId, vertex),
  );
}

export function validateBuyDevelopmentCard(
  state: CatanState,
  playerId: string,
): GameValidationResult {
  return firstInvalid(
    () => validateStep(state, 'MAIN'),
    () =>
      state.developmentDeck.length === 0
        ? invalid(CatanRuleCodes.DeckEmpty, 'There are no development cards left.')
        : VALID,
    () => validateCanPay(state, playerId, 'developmentCard'),
  );
}
