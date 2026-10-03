import type { Cell, Position } from './board.js';

export type GridClaimPhase = 'PLAYING' | 'FINISHED';

export interface GridClaimState {
  id: string;
  engineVersion: number;
  phase: GridClaimPhase;

  size: number;
  targetScore: number;

  /** Seat order. */
  playerIds: string[];

  /** Row-major, length size * size. */
  cells: Cell[];

  turn: {
    number: number;
    activePlayerId: string;
  };

  lastPlacementByPlayer: Record<string, Position | null>;

  winnerPlayerIds: string[];
}
