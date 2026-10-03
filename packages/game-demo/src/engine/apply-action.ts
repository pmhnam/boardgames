import { GameRuleError, type GameActionContext } from '@bgp/game-core';
import type { GridClaimAction, PlacePieceAction } from '../domain/actions.js';
import { toIndex } from '../domain/board.js';
import type { GridClaimState } from '../domain/state.js';
import { evaluateEndGame } from '../rules/end-game.rules.js';
import { getOpponentId } from '../rules/turn.rules.js';
import { validateAction } from './validate-action.js';

function applyPlacePiece(
  state: GridClaimState,
  action: PlacePieceAction,
  playerId: string,
): GridClaimState {
  const cells = [...state.cells];
  cells[toIndex(state.size, action.position)] = playerId;

  const placed: GridClaimState = {
    ...state,
    cells,
    lastPlacementByPlayer: {
      ...state.lastPlacementByPlayer,
      [playerId]: { ...action.position },
    },
  };

  const nextPlayerId = getOpponentId(state, playerId);
  const outcome = evaluateEndGame(placed, playerId, nextPlayerId);

  if (outcome.finished) {
    return { ...placed, phase: 'FINISHED', winnerPlayerIds: outcome.winnerPlayerIds };
  }

  return {
    ...placed,
    turn: { number: state.turn.number + 1, activePlayerId: nextPlayerId },
  };
}

export function applyAction(
  state: GridClaimState,
  action: GridClaimAction,
  context: GameActionContext,
): GridClaimState {
  const validation = validateAction(state, action, context);
  if (!validation.valid) {
    throw new GameRuleError(validation.code, validation.message);
  }

  switch (action.type) {
    case 'PLACE_PIECE':
      return applyPlacePiece(state, action, context.actorPlayerId);
  }
}
