import type { CatanState } from '../domain/state.js';
import { getPoints } from '../scoring/score.js';

/** A player wins only on their own turn, the moment they have enough points. */
export function findWinner(state: CatanState): string | null {
  const playerId = state.turn.activePlayerId;
  return getPoints(state, playerId) >= state.config.victoryPointsToWin ? playerId : null;
}
