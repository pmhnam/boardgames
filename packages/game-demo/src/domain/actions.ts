import type { Position } from './board.js';

export interface PlacePieceAction {
  type: 'PLACE_PIECE';
  position: Position;
}

export type GridClaimAction = PlacePieceAction;
