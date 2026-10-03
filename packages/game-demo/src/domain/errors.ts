import { CommonRuleCodes } from '@bgp/game-core';

export const GridClaimRuleCodes = {
  ...CommonRuleCodes,
  InvalidPosition: 'INVALID_POSITION',
  CellBlocked: 'CELL_BLOCKED',
  CellOccupied: 'CELL_OCCUPIED',
  AdjacentToOpponentLastPiece: 'ADJACENT_TO_OPPONENT_LAST_PIECE',
} as const;
