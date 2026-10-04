import type { GameValidationResult } from '@bgp/game-core';
import { AvalonRuleCodes } from '../domain/errors.js';
import type { AvalonState } from '../domain/state.js';
import { NOT_YOUR_TURN, isPlayer } from './table.rules.js';

/** Everyone who holds or has held the Lady. None of them can be looked at again. */
export function getLadyHolders(state: Pick<AvalonState, 'lady'>): string[] {
  if (!state.lady) return [];
  return [...state.lady.inspections.map((inspection) => inspection.holderId), state.lady.holderId];
}

export function getLadyTargets(state: Pick<AvalonState, 'lady' | 'seatOrder'>): string[] {
  if (!state.lady) return [];
  const holders = getLadyHolders(state);
  return state.seatOrder.filter((playerId) => !holders.includes(playerId));
}

/** Whether the Lady is used now that this many quests are complete. */
export function isLadyDue(state: Pick<AvalonState, 'lady' | 'seatOrder' | 'rules' | 'quests'>) {
  return (
    state.rules.ladyAfterQuests.includes(state.quests.length) && getLadyTargets(state).length > 0
  );
}

/** Checked against public facts only, so a refusal says nothing about anyone's side. */
export function validateUseLady(
  state: AvalonState,
  playerId: string,
  targetId: string,
): GameValidationResult {
  if (state.lady?.holderId !== playerId) return NOT_YOUR_TURN;
  if (!isPlayer(state, targetId) || targetId === playerId) {
    return {
      valid: false,
      code: AvalonRuleCodes.InvalidTarget,
      message: 'Choose another player.',
    };
  }
  if (getLadyHolders(state).includes(targetId)) {
    return {
      valid: false,
      code: AvalonRuleCodes.LadyAlreadyHeld,
      message: 'That player has already held the Lady of the Lake.',
    };
  }
  return { valid: true };
}
