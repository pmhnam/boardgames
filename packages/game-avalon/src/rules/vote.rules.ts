import type { GameValidationResult } from '@bgp/game-core';
import { AvalonRuleCodes } from '../domain/errors.js';
import type { AvalonState } from '../domain/state.js';
import { NOT_YOUR_TURN, isPlayer } from './table.rules.js';

export function hasVoted(state: Pick<AvalonState, 'current'>, playerId: string): boolean {
  return state.current.votes[playerId] !== undefined;
}

export function validateVote(
  state: AvalonState,
  playerId: string,
  proposal: number,
): GameValidationResult {
  if (!isPlayer(state, playerId)) return NOT_YOUR_TURN;
  if (proposal !== state.proposals.length) {
    return {
      valid: false,
      code: AvalonRuleCodes.StaleProposal,
      message: 'That team has already been voted on.',
    };
  }
  if (hasVoted(state, playerId)) {
    return {
      valid: false,
      code: AvalonRuleCodes.AlreadyVoted,
      message: 'You have already voted on this team.',
    };
  }
  return { valid: true };
}

/** A team goes ahead on a strict majority: a tie rejects it. */
export function isApproved(
  seatOrder: readonly string[],
  votes: Readonly<Record<string, boolean>>,
): boolean {
  const approvals = seatOrder.filter((playerId) => votes[playerId] === true).length;
  return approvals * 2 > seatOrder.length;
}
