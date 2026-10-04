import type { GameValidationResult } from '@bgp/game-core';
import { QUESTS_TO_WIN } from '../domain/config.js';
import { AvalonRuleCodes } from '../domain/errors.js';
import type { AvalonState, QuestRecord } from '../domain/state.js';
import { NOT_YOUR_TURN, getAlignment, getQuestIndex } from './table.rules.js';

export function hasPlayed(state: Pick<AvalonState, 'current'>, playerId: string): boolean {
  return state.current.cards[playerId] !== undefined;
}

export function validatePlayQuestCard(
  state: AvalonState,
  playerId: string,
  quest: number,
  success: boolean,
): GameValidationResult {
  if (!state.current.team?.includes(playerId)) return NOT_YOUR_TURN;
  if (quest !== getQuestIndex(state)) {
    return {
      valid: false,
      code: AvalonRuleCodes.StaleQuest,
      message: 'That quest is already over.',
    };
  }
  if (hasPlayed(state, playerId)) {
    return {
      valid: false,
      code: AvalonRuleCodes.AlreadyPlayed,
      message: 'You have already played a card on this quest.',
    };
  }
  if (!success && getAlignment(state, playerId) === 'GOOD') {
    return {
      valid: false,
      code: AvalonRuleCodes.MustPlaySuccess,
      message: 'The good side must play Success.',
    };
  }
  return { valid: true };
}

export function getFailCount(quest: QuestRecord): number {
  return quest.team.filter((playerId) => quest.cards[playerId] === false).length;
}

export function isQuestSuccess(
  state: Pick<AvalonState, 'rules' | 'quests'>,
  index: number,
): boolean {
  const quest = state.quests[index];
  const failsRequired = state.rules.failsRequired[index];
  if (!quest || failsRequired === undefined) throw new Error(`Quest ${index} is not complete`);
  return getFailCount(quest) < failsRequired;
}

export function countQuests(state: Pick<AvalonState, 'rules' | 'quests'>): {
  succeeded: number;
  failed: number;
} {
  const succeeded = state.quests.filter((_, index) => isQuestSuccess(state, index)).length;
  return { succeeded, failed: state.quests.length - succeeded };
}

/** Which side the quests have decided for, once one has enough of them. */
export function getQuestVerdict(
  state: Pick<AvalonState, 'rules' | 'quests'>,
): 'GOOD' | 'EVIL' | null {
  const { succeeded, failed } = countQuests(state);
  if (failed >= QUESTS_TO_WIN) return 'EVIL';
  return succeeded >= QUESTS_TO_WIN ? 'GOOD' : null;
}
