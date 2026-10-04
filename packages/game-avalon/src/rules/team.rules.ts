import type { GameValidationResult } from '@bgp/game-core';
import { AvalonRuleCodes } from '../domain/errors.js';
import type { AvalonState } from '../domain/state.js';
import { NOT_YOUR_TURN, getLeaderId, getTeamSize, isPlayer } from './table.rules.js';

export function validateProposeTeam(
  state: AvalonState,
  playerId: string,
  team: readonly string[],
): GameValidationResult {
  if (getLeaderId(state) !== playerId) return NOT_YOUR_TURN;

  const size = getTeamSize(state);
  const distinct = new Set(team).size === team.length;
  if (team.length !== size || !distinct || !team.every((id) => isPlayer(state, id))) {
    return {
      valid: false,
      code: AvalonRuleCodes.InvalidTeam,
      message: `This quest needs a team of ${size} different players.`,
    };
  }
  return { valid: true };
}
