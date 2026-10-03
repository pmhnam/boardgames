import type { GameValidationResult } from '@bgp/game-core';
import {
  BLOCKED,
  areAdjacent,
  cellAt,
  isInsideBoard,
  toPosition,
  type Position,
} from '../domain/board.js';
import { GridClaimRuleCodes } from '../domain/errors.js';
import type { GridClaimState } from '../domain/state.js';
import { getOpponentId } from './turn.rules.js';

type PlacementState = Pick<
  GridClaimState,
  'cells' | 'size' | 'playerIds' | 'lastPlacementByPlayer'
>;

/** Placement legality only; whose turn it is belongs to turn.rules. */
export function validatePlacement(
  state: PlacementState,
  playerId: string,
  position: Position,
): GameValidationResult {
  if (!isInsideBoard(state.size, position)) {
    return {
      valid: false,
      code: GridClaimRuleCodes.InvalidPosition,
      message: 'Position is outside the board.',
    };
  }

  const cell = cellAt(state.cells, state.size, position);
  if (cell === BLOCKED) {
    return { valid: false, code: GridClaimRuleCodes.CellBlocked, message: 'That cell is blocked.' };
  }
  if (cell !== null) {
    return {
      valid: false,
      code: GridClaimRuleCodes.CellOccupied,
      message: 'That cell is already occupied.',
    };
  }

  const opponentLast = state.lastPlacementByPlayer[getOpponentId(state, playerId)] ?? null;
  if (opponentLast !== null && areAdjacent(opponentLast, position)) {
    return {
      valid: false,
      code: GridClaimRuleCodes.AdjacentToOpponentLastPiece,
      message: "You cannot place next to your opponent's last piece.",
    };
  }

  return { valid: true };
}

export function getLegalPositions(state: PlacementState, playerId: string): Position[] {
  return state.cells
    .map((_, index) => toPosition(state.size, index))
    .filter((position) => validatePlacement(state, playerId, position).valid);
}
