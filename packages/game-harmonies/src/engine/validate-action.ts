import type { GameActionContext, GameValidationResult } from '@bgp/game-core';
import type { HarmoniesAction } from '../domain/actions.js';
import { HarmoniesRuleCodes } from '../domain/errors.js';
import type { HarmoniesState } from '../domain/state.js';
import { validatePlaceCube, validateTakeCard } from '../rules/card.rules.js';
import { validateTokenPlacement } from '../rules/token-placement.rules.js';
import { getBoard, validateCanAct, validateEndTurn } from '../rules/turn.rules.js';

function validateTakeTokens(state: HarmoniesState, spaceIndex: number): GameValidationResult {
  if (state.turn.tokensTaken) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.TokensAlreadyTaken,
      message: 'You already took tokens this turn.',
    };
  }
  const space = state.centralSpaces[spaceIndex];
  if (space === undefined) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.InvalidSpace,
      message: 'There is no such space on the central board.',
    };
  }
  if (space.length === 0) {
    return { valid: false, code: HarmoniesRuleCodes.SpaceEmpty, message: 'That space is empty.' };
  }
  return { valid: true };
}

export function validateAction(
  state: HarmoniesState,
  action: HarmoniesAction,
  context: GameActionContext,
): GameValidationResult {
  const canAct = validateCanAct(state, context.actorPlayerId);
  if (!canAct.valid) return canAct;

  const board = getBoard(state, context.actorPlayerId);

  switch (action.type) {
    case 'TAKE_TOKENS':
      return validateTakeTokens(state, action.spaceIndex);
    case 'PLACE_TOKEN':
      if (!state.turn.hand.includes(action.color)) {
        return {
          valid: false,
          code: HarmoniesRuleCodes.TokenNotInHand,
          message: `You are not holding a ${action.color} token.`,
        };
      }
      return validateTokenPlacement(state.config, board, action.color, action.cell);
    case 'TAKE_CARD':
      return validateTakeCard(state, board, action.cardId);
    case 'PLACE_CUBE':
      return validatePlaceCube(state.config, board, action.cardId, action.cell);
    case 'END_TURN':
      return validateEndTurn(state);
  }
}
