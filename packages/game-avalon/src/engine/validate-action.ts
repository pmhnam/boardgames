import type { GameActionContext, GameValidationResult } from '@bgp/game-core';
import type { AvalonAction } from '../domain/actions.js';
import type { AvalonPhase, AvalonState } from '../domain/state.js';
import { validateAssassinate } from '../rules/assassination.rules.js';
import { validateUseLady } from '../rules/lady.rules.js';
import { validatePlayQuestCard } from '../rules/quest.rules.js';
import { validatePhase } from '../rules/table.rules.js';
import { validateProposeTeam } from '../rules/team.rules.js';
import { validateVote } from '../rules/vote.rules.js';

const PHASE_OF: Record<AvalonAction['type'], AvalonPhase> = {
  PROPOSE_TEAM: 'TEAM_PROPOSAL',
  VOTE: 'TEAM_VOTE',
  PLAY_QUEST_CARD: 'QUEST',
  USE_LADY: 'LADY',
  ASSASSINATE: 'ASSASSINATION',
};

/**
 * Every refusal follows from what the actor may already know: public facts and their own role.
 */
export function validateAction(
  state: AvalonState,
  action: AvalonAction,
  context: GameActionContext,
): GameValidationResult {
  const phase = validatePhase(state, PHASE_OF[action.type]);
  if (!phase.valid) return phase;

  const playerId = context.actorPlayerId;
  switch (action.type) {
    case 'PROPOSE_TEAM':
      return validateProposeTeam(state, playerId, action.team);
    case 'VOTE':
      return validateVote(state, playerId, action.proposal);
    case 'PLAY_QUEST_CARD':
      return validatePlayQuestCard(state, playerId, action.quest, action.success);
    case 'USE_LADY':
      return validateUseLady(state, playerId, action.targetId);
    case 'ASSASSINATE':
      return validateAssassinate(state, playerId, action.targetId);
  }
}
