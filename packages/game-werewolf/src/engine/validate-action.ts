import type { GameActionContext, GameValidationResult } from '@bgp/game-core';
import type { WerewolfAction } from '../domain/actions.js';
import { WerewolfRuleCodes } from '../domain/errors.js';
import type { WerewolfState } from '../domain/state.js';
import { getLegalMoves, type LegalMoves } from '../rules/legal-moves.js';

const VALID: GameValidationResult = { valid: true };

function reject(code: string, message: string): GameValidationResult {
  return { valid: false, code, message };
}

const INVALID_TARGET = reject(WerewolfRuleCodes.InvalidTarget, 'You cannot choose that player.');

function validateTarget(legal: LegalMoves, targetId: string | null): GameValidationResult {
  if (targetId === null) {
    return legal.canSkip
      ? VALID
      : reject(WerewolfRuleCodes.SkipNotAllowed, 'You have to choose a player.');
  }
  return legal.targets.includes(targetId) ? VALID : INVALID_TARGET;
}

function validateWitch(
  legal: LegalMoves,
  heal: boolean,
  poisonTargetId: string | null,
): GameValidationResult {
  if (heal && !legal.canHeal) {
    return reject(WerewolfRuleCodes.HealNotAvailable, 'There is nobody you can save tonight.');
  }
  if (poisonTargetId !== null && legal.targets.length === 0) {
    return reject(WerewolfRuleCodes.PoisonNotAvailable, 'Your poison is spent.');
  }
  return validateTarget(legal, poisonTargetId);
}

/**
 * Everything is judged against what `getLegalMoves` offers this player, so a refusal never
 * says more than their own view already does.
 */
export function validateAction(
  state: WerewolfState,
  action: WerewolfAction,
  context: GameActionContext,
): GameValidationResult {
  if (state.phase === 'FINISHED') {
    return reject(WerewolfRuleCodes.GameNotPlaying, 'The match is over.');
  }
  const legal = getLegalMoves(state, context.actorPlayerId);
  if (legal.action === null) {
    return reject(WerewolfRuleCodes.NotYourTurn, 'There is nothing for you to do right now.');
  }
  if (action.type !== legal.action) {
    return reject(WerewolfRuleCodes.WrongAction, 'That is not what you are asked to do now.');
  }

  switch (action.type) {
    case 'CUPID_LINK':
      if (action.firstId === action.secondId) return INVALID_TARGET;
      return [action.firstId, action.secondId].every((id) => legal.targets.includes(id))
        ? VALID
        : INVALID_TARGET;
    case 'WOLF_VOTE':
    case 'SEER_INSPECT':
    case 'GUARD_PROTECT':
    case 'CAST_VOTE':
    case 'HUNTER_SHOOT':
      return validateTarget(legal, action.targetId);
    case 'WITCH_DECIDE':
      return validateWitch(legal, action.heal, action.poisonTargetId);
    case 'SLEEP':
    case 'READY_TO_VOTE':
      return VALID;
  }
}
