import type { AvalonState } from '../domain/state.js';
import { getAssassinId } from './assassination.rules.js';
import { getLadyTargets } from './lady.rules.js';
import { hasPlayed } from './quest.rules.js';
import { getAlignment, getLeaderId, getQuestIndex, getTeamSize, isPlayer } from './table.rules.js';
import { hasVoted } from './vote.rules.js';

/** What one player may do right now. Everything is empty when they have nothing to do. */
export interface LegalMoves {
  /** The leader picks this many players. */
  propose: { teamSize: number } | null;
  /** The proposal to name in the vote. */
  vote: { proposal: number } | null;
  /** The quest to name in the card, and whether Fail is allowed. */
  quest: { quest: number; canFail: boolean } | null;
  ladyTargets: string[];
  assassinTargets: string[];
}

export const NO_LEGAL_MOVES: LegalMoves = {
  propose: null,
  vote: null,
  quest: null,
  ladyTargets: [],
  assassinTargets: [],
};

/** Who still owes an action. In a phase where everyone acts, those who have acted drop out. */
export function getCurrentPlayerIds(state: AvalonState): string[] {
  switch (state.phase) {
    case 'TEAM_PROPOSAL':
      return [getLeaderId(state)];
    case 'TEAM_VOTE':
      return state.seatOrder.filter((playerId) => !hasVoted(state, playerId));
    case 'QUEST':
      return state.seatOrder.filter(
        (playerId) => state.current.team?.includes(playerId) && !hasPlayed(state, playerId),
      );
    case 'LADY':
      return state.lady ? [state.lady.holderId] : [];
    case 'ASSASSINATION':
      return [getAssassinId(state)];
    case 'FINISHED':
      return [];
  }
}

export function getLegalMoves(state: AvalonState, playerId: string): LegalMoves {
  if (!isPlayer(state, playerId) || !getCurrentPlayerIds(state).includes(playerId)) {
    return NO_LEGAL_MOVES;
  }
  switch (state.phase) {
    case 'TEAM_PROPOSAL':
      return { ...NO_LEGAL_MOVES, propose: { teamSize: getTeamSize(state) } };
    case 'TEAM_VOTE':
      return { ...NO_LEGAL_MOVES, vote: { proposal: state.proposals.length } };
    case 'QUEST':
      return {
        ...NO_LEGAL_MOVES,
        quest: { quest: getQuestIndex(state), canFail: getAlignment(state, playerId) === 'EVIL' },
      };
    case 'LADY':
      return { ...NO_LEGAL_MOVES, ladyTargets: getLadyTargets(state) };
    case 'ASSASSINATION':
      return {
        ...NO_LEGAL_MOVES,
        assassinTargets: state.seatOrder.filter((otherId) => otherId !== playerId),
      };
    case 'FINISHED':
      return NO_LEGAL_MOVES;
  }
}
