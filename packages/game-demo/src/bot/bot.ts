import type { BotDecisionInput, BotStrategy, SeededRandom } from '@bgp/game-core';
import type { GridClaimAction } from '../domain/actions.js';
import { toIndex, type Position } from '../domain/board.js';
import { getLegalPositions } from '../rules/placement.rules.js';
import { getOpponentId } from '../rules/turn.rules.js';
import { calculatePlayerScore } from '../scoring/score.js';
import type { GridClaimView } from '../visibility/public-view.js';

/** The part of a view a placement changes. */
type Board = Pick<GridClaimView, 'cells' | 'size' | 'playerIds' | 'lastPlacementByPlayer'>;

function place(board: Board, playerId: string, position: Position): Board {
  const cells = [...board.cells];
  cells[toIndex(board.size, position)] = playerId;
  return {
    ...board,
    cells,
    lastPlacementByPlayer: { ...board.lastPlacementByPlayer, [playerId]: position },
  };
}

/** Picks the best-scoring option; ties are broken at random so games do not repeat. */
function pickBest<T>(options: readonly T[], value: (option: T) => number, random: SeededRandom): T {
  let best: T[] = [];
  let bestValue = -Infinity;
  for (const option of options) {
    const optionValue = value(option);
    if (optionValue > bestValue) {
      best = [option];
      bestValue = optionValue;
    } else if (optionValue === bestValue) {
      best.push(option);
    }
  }
  return random.pick(best);
}

/** How good the board is for `playerId` right after they place at `position`. */
function valueOf(
  view: GridClaimView,
  playerId: string,
  position: Position,
  lookAhead: boolean,
): number {
  const after = place(view, playerId, position);
  const myScore = calculatePlayerScore(after, playerId);
  if (myScore >= view.targetScore) return 1000 + myScore;
  if (!lookAhead) return myScore;

  // The opponent answers with their own best placement.
  const opponentId = getOpponentId(view, playerId);
  const replies = getLegalPositions(after, opponentId);
  const bestReply = Math.max(
    calculatePlayerScore(after, opponentId),
    ...replies.map((reply) => calculatePlayerScore(place(after, opponentId, reply), opponentId)),
  );
  if (bestReply >= view.targetScore) return -1000 + myScore;
  return myScore - bestReply;
}

/**
 * - easy: any legal placement;
 * - normal: the placement that scores most now;
 * - hard: the placement that leaves the best margin after the opponent's best reply.
 */
export const GridClaimBot: BotStrategy<GridClaimView, GridClaimAction> = {
  chooseAction({ view, playerId, level, random }: BotDecisionInput<GridClaimView>) {
    const options = view.legalPositions;
    if (options.length === 0) throw new Error('Grid Claim bot asked to move with no legal move');

    const position =
      level === 'easy'
        ? random.pick(options)
        : pickBest(options, (option) => valueOf(view, playerId, option, level === 'hard'), random);
    return { type: 'PLACE_PIECE', position };
  },
};
