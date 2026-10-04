import { AvalonRuleCodes } from '../domain/errors.js';
import { alignmentOf, type Alignment, type Role } from '../domain/roles.js';
import type { AvalonPhase, AvalonState } from '../domain/state.js';

export function isPlayer(state: Pick<AvalonState, 'seatOrder'>, playerId: string): boolean {
  return state.seatOrder.includes(playerId);
}

export function getRole(state: Pick<AvalonState, 'roles'>, playerId: string): Role {
  const role = state.roles[playerId];
  if (!role) throw new Error(`Unknown player ${playerId}`);
  return role;
}

export function getAlignment(state: Pick<AvalonState, 'roles'>, playerId: string): Alignment {
  return alignmentOf(getRole(state, playerId));
}

/** Index of the quest in progress: the number of quests already completed. */
export function getQuestIndex(state: Pick<AvalonState, 'quests'>): number {
  return state.quests.length;
}

/**
 * Who leads the proposal in flight, or the next one. Leadership moves one seat on after every
 * settled proposal, approved or not.
 */
export function getLeaderId(
  state: Pick<AvalonState, 'seatOrder' | 'firstLeaderIndex' | 'proposals'>,
): string {
  const index = (state.firstLeaderIndex + state.proposals.length) % state.seatOrder.length;
  const leaderId = state.seatOrder[index];
  if (leaderId === undefined) throw new Error('No players');
  return leaderId;
}

/** Proposals for the quest in progress rejected so far. They are always in a row. */
export function getRejections(state: Pick<AvalonState, 'proposals' | 'quests'>): number {
  const quest = getQuestIndex(state);
  return state.proposals.filter((proposal) => proposal.quest === quest && !proposal.approved)
    .length;
}

export function getTeamSize(state: Pick<AvalonState, 'rules' | 'quests'>): number {
  const size = state.rules.teamSizes[getQuestIndex(state)];
  if (size === undefined) throw new Error('No quest in progress');
  return size;
}

/** The same record with its keys in seat order, whatever order the entries arrived in. */
export function inSeatOrder<T>(
  seatOrder: readonly string[],
  entries: Readonly<Record<string, T>>,
): Record<string, T> {
  const ordered: Record<string, T> = {};
  for (const playerId of seatOrder) {
    const entry = entries[playerId];
    if (entry !== undefined) ordered[playerId] = entry;
  }
  return ordered;
}

const PHASE_INSTRUCTIONS: Record<AvalonPhase, string> = {
  TEAM_PROPOSAL: 'The leader is choosing a team.',
  TEAM_VOTE: 'Everyone is voting on the team.',
  QUEST: 'The team is on the quest.',
  LADY: 'The Lady of the Lake is being used.',
  ASSASSINATION: 'The Assassin is choosing a target.',
  FINISHED: 'The game is not in progress.',
};

export function validatePhase(state: Pick<AvalonState, 'phase'>, phase: AvalonPhase) {
  if (state.phase === 'FINISHED') {
    return {
      valid: false as const,
      code: AvalonRuleCodes.GameNotPlaying,
      message: PHASE_INSTRUCTIONS.FINISHED,
    };
  }
  if (state.phase !== phase) {
    return {
      valid: false as const,
      code: AvalonRuleCodes.WrongPhase,
      message: PHASE_INSTRUCTIONS[state.phase],
    };
  }
  return { valid: true as const };
}

export const NOT_YOUR_TURN = {
  valid: false as const,
  code: AvalonRuleCodes.NotYourTurn,
  message: 'It is not your turn.',
};
