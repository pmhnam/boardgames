import { orthogonalNeighbours, toPosition, cellAt } from '../domain/board.js';
import type { GridClaimState } from '../domain/state.js';

/**
 * One point per piece, plus one point per pair of orthogonally adjacent own pieces.
 */
export function calculatePlayerScore(
  state: Pick<GridClaimState, 'cells' | 'size'>,
  playerId: string,
): number {
  let pieces = 0;
  let adjacentEnds = 0;

  state.cells.forEach((cell, index) => {
    if (cell !== playerId) return;
    pieces += 1;
    for (const neighbour of orthogonalNeighbours(state.size, toPosition(state.size, index))) {
      if (cellAt(state.cells, state.size, neighbour) === playerId) adjacentEnds += 1;
    }
  });

  // Each pair was counted from both ends.
  return pieces + adjacentEnds / 2;
}

export function calculateScores(
  state: Pick<GridClaimState, 'cells' | 'size' | 'playerIds'>,
): Record<string, number> {
  return Object.fromEntries(
    state.playerIds.map((playerId) => [playerId, calculatePlayerScore(state, playerId)]),
  );
}
