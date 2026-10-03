import { countEmptyCells } from '../domain/board.js';
import { END_TRIGGER_EMPTY_CELLS, TOKENS_PER_SPACE } from '../domain/config.js';
import type { HarmoniesState } from '../domain/state.js';
import { calculateScores } from '../scoring/score.js';
import { getBoard } from './turn.rules.js';

/**
 * Checked as a turn ends, before the central board is refilled. The final round starts when the
 * player's board is nearly full or the pouch can no longer refill a space.
 */
export function triggersFinalRound(
  state: Pick<HarmoniesState, 'boards' | 'pouch' | 'config'>,
  playerId: string,
): boolean {
  return (
    countEmptyCells(state.config.boardCells, getBoard(state, playerId)) <=
      END_TRIGGER_EMPTY_CELLS || state.pouch.length < TOKENS_PER_SPACE
  );
}

/** Highest total wins. Ties go to whoever placed more animal cubes, then are shared. */
export function determineWinners(
  state: Pick<HarmoniesState, 'boards' | 'turnOrder' | 'config'>,
): string[] {
  const scores = calculateScores(state);
  const ranked = state.turnOrder.map((playerId) => ({
    playerId,
    total: scores[playerId]?.total ?? 0,
    cubes: getBoard(state, playerId).cubes.length,
  }));
  const bestTotal = Math.max(...ranked.map((entry) => entry.total));
  const leaders = ranked.filter((entry) => entry.total === bestTotal);
  const bestCubes = Math.max(...leaders.map((entry) => entry.cubes));
  return leaders.filter((entry) => entry.cubes === bestCubes).map((entry) => entry.playerId);
}
