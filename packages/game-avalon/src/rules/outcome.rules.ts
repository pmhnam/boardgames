import type { Alignment } from '../domain/roles.js';
import type { AvalonState } from '../domain/state.js';
import { getQuestVerdict } from './quest.rules.js';
import { getAlignment } from './table.rules.js';

export type OutcomeReason =
  'QUESTS_FAILED' | 'TEAMS_REJECTED' | 'MERLIN_ASSASSINATED' | 'MERLIN_SURVIVED';

export interface Outcome {
  winner: Alignment;
  reason: OutcomeReason;
}

/** Null until the game is finished. */
export function getOutcome(state: AvalonState): Outcome | null {
  if (state.phase !== 'FINISHED') return null;
  if (state.assassinTargetId !== null) {
    return state.roles[state.assassinTargetId] === 'MERLIN'
      ? { winner: 'EVIL', reason: 'MERLIN_ASSASSINATED' }
      : { winner: 'GOOD', reason: 'MERLIN_SURVIVED' };
  }
  // Without an assassination the game can only have ended in evil's favour.
  return {
    winner: 'EVIL',
    reason: getQuestVerdict(state) === 'EVIL' ? 'QUESTS_FAILED' : 'TEAMS_REJECTED',
  };
}

/** Everyone on the winning side, in seat order. */
export function getWinners(state: AvalonState): string[] {
  const outcome = getOutcome(state);
  if (!outcome) return [];
  return state.seatOrder.filter((playerId) => getAlignment(state, playerId) === outcome.winner);
}
