import type { GameActionContext, GameValidationResult } from '@bgp/game-core';
import type { CatanAction } from '../domain/actions.js';
import { CatanRuleCodes, invalid } from '../domain/errors.js';
import type { CatanState } from '../domain/state.js';
import {
  validateBuildCity,
  validateBuildRoad,
  validateBuildSettlement,
  validateBuyDevelopmentCard,
} from '../rules/build.rules.js';
import { validatePlayCard, validateInvention } from '../rules/development.rules.js';
import { validateSettlementSite, validateSetupRoadSite } from '../rules/placement.rules.js';
import { validateDiscard, validateMoveRobber } from '../rules/robber.rules.js';
import {
  validateCancelTrade,
  validateConfirmTrade,
  validateProposeTrade,
  validateRespondTrade,
  validateSupplyTrade,
} from '../rules/trade.rules.js';
import { validateIsActive, validateNothingPending, validateStep } from '../rules/turn.rules.js';

/** What the active player may do once nothing is waiting on anyone. */
function validateTurnAction(
  state: CatanState,
  action: CatanAction,
  playerId: string,
): GameValidationResult {
  switch (action.type) {
    case 'ROLL_DICE':
      return validateStep(state, 'ROLL');
    case 'BUILD_SETTLEMENT':
      return validateBuildSettlement(state, playerId, action.vertex);
    case 'BUILD_CITY':
      return validateBuildCity(state, playerId, action.vertex);
    case 'BUY_DEVELOPMENT_CARD':
      return validateBuyDevelopmentCard(state, playerId);
    case 'PLAY_KNIGHT':
      return validatePlayCard(state, playerId, 'knight');
    case 'PLAY_ROAD_BUILDING':
      return validatePlayCard(state, playerId, 'roadBuilding');
    case 'PLAY_INVENTION':
      return validateInvention(state, playerId, action.resources);
    case 'PLAY_MONOPOLY':
      return validatePlayCard(state, playerId, 'monopoly');
    case 'SUPPLY_TRADE':
      return validateSupplyTrade(state, playerId, action.give, action.receive);
    case 'PROPOSE_TRADE':
      return validateProposeTrade(state, playerId, action.give, action.receive);
    case 'END_TURN':
      return validateStep(state, 'MAIN');
    default:
      throw new Error(`Unexpected action ${action.type}`);
  }
}

export function validateAction(
  state: CatanState,
  action: CatanAction,
  context: GameActionContext,
): GameValidationResult {
  const playerId = context.actorPlayerId;
  if (state.phase !== 'PLAYING') {
    return invalid(CatanRuleCodes.GameNotPlaying, 'The game is not in progress.');
  }
  if (!state.players[playerId]) {
    return invalid(CatanRuleCodes.NotYourTurn, 'You are not playing in this game.');
  }

  // The two things a player does out of turn.
  if (action.type === 'DISCARD') return validateDiscard(state, playerId, action.resources);
  if (action.type === 'RESPOND_TRADE') {
    return validateRespondTrade(state, playerId, action.offerId, action.accept);
  }

  const active = validateIsActive(state, playerId);
  if (!active.valid) return active;

  switch (action.type) {
    case 'CONFIRM_TRADE':
      return validateConfirmTrade(state, action.playerId);
    case 'CANCEL_TRADE':
      return validateCancelTrade(state);
    case 'PLACE_SETUP_SETTLEMENT': {
      const step = validateStep(state, 'SETUP_SETTLEMENT');
      return step.valid ? validateSettlementSite(state, action.vertex) : step;
    }
    case 'PLACE_SETUP_ROAD': {
      const step = validateStep(state, 'SETUP_ROAD');
      return step.valid ? validateSetupRoadSite(state, action.edge) : step;
    }
    case 'MOVE_ROBBER': {
      const step = validateStep(state, 'ROBBER');
      return step.valid ? validateMoveRobber(state, playerId, action.hex, action.victimId) : step;
    }
    case 'BUILD_ROAD': {
      // The one thing allowed while free roads are waiting: placing them.
      if (state.turn.offer) return validateNothingPending(state);
      return validateBuildRoad(state, playerId, action.edge);
    }
    default: {
      const pending = validateNothingPending(state);
      return pending.valid ? validateTurnAction(state, action, playerId) : pending;
    }
  }
}
