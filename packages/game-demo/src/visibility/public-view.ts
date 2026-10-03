import type { GameViewer } from '@bgp/game-core';
import type { Cell, Position } from '../domain/board.js';
import type { GridClaimPhase, GridClaimState } from '../domain/state.js';
import { getLegalPositions } from '../rules/placement.rules.js';
import { calculateScores } from '../scoring/score.js';

export interface GridClaimView {
  id: string;
  phase: GridClaimPhase;
  size: number;
  targetScore: number;
  playerIds: string[];
  cells: Cell[];
  turn: { number: number; activePlayerId: string };
  lastPlacementByPlayer: Record<string, Position | null>;
  scores: Record<string, number>;
  winnerPlayerIds: string[];
  /** Where the viewer may place right now. Empty unless it is the viewer's turn. */
  legalPositions: Position[];
}

/**
 * Grid Claim has no hidden information, so every viewer sees the same board. The view is still
 * built explicitly (never the raw state) so adding hidden data later cannot leak by default.
 */
export function getPublicView(state: GridClaimState, viewer: GameViewer): GridClaimView {
  const isActiveViewer =
    viewer.type === 'player' &&
    state.phase === 'PLAYING' &&
    state.turn.activePlayerId === viewer.playerId;

  return {
    id: state.id,
    phase: state.phase,
    size: state.size,
    targetScore: state.targetScore,
    playerIds: [...state.playerIds],
    cells: [...state.cells],
    turn: { ...state.turn },
    lastPlacementByPlayer: { ...state.lastPlacementByPlayer },
    scores: calculateScores(state),
    winnerPlayerIds: [...state.winnerPlayerIds],
    legalPositions: isActiveViewer ? getLegalPositions(state, viewer.playerId) : [],
  };
}
