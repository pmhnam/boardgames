import type { GridClaimState } from '../domain/state.js';
import { calculateScores } from '../scoring/score.js';
import { getLegalPositions } from './placement.rules.js';

export type EndGameOutcome = { finished: false } | { finished: true; winnerPlayerIds: string[] };

type EndGameState = Pick<
  GridClaimState,
  'cells' | 'size' | 'playerIds' | 'lastPlacementByPlayer' | 'targetScore'
>;

/**
 * Evaluated after `moverId` has placed and before `nextPlayerId` moves.
 * - Reaching the target score wins immediately.
 * - If the next player has no legal placement, the highest score wins (ties are shared).
 */
export function evaluateEndGame(
  state: EndGameState,
  moverId: string,
  nextPlayerId: string,
): EndGameOutcome {
  const scores = calculateScores(state);

  if ((scores[moverId] ?? 0) >= state.targetScore) {
    return { finished: true, winnerPlayerIds: [moverId] };
  }

  if (getLegalPositions(state, nextPlayerId).length === 0) {
    const best = Math.max(...state.playerIds.map((playerId) => scores[playerId] ?? 0));
    return {
      finished: true,
      winnerPlayerIds: state.playerIds.filter((playerId) => scores[playerId] === best),
    };
  }

  return { finished: false };
}
