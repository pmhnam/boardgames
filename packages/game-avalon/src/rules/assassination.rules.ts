import type { GameValidationResult } from '@bgp/game-core';
import { AvalonRuleCodes } from '../domain/errors.js';
import type { AvalonState } from '../domain/state.js';
import { NOT_YOUR_TURN, isPlayer } from './table.rules.js';

export function getAssassinId(state: Pick<AvalonState, 'seatOrder' | 'roles'>): string {
  const assassinId = state.seatOrder.find((playerId) => state.roles[playerId] === 'ASSASSIN');
  if (assassinId === undefined) throw new Error('No Assassin in play');
  return assassinId;
}

/**
 * Any other player may be named, evil ones included: refusing them would tell the Assassin
 * who Oberon is.
 */
export function validateAssassinate(
  state: AvalonState,
  playerId: string,
  targetId: string,
): GameValidationResult {
  if (getAssassinId(state) !== playerId) return NOT_YOUR_TURN;
  if (!isPlayer(state, targetId) || targetId === playerId) {
    return {
      valid: false,
      code: AvalonRuleCodes.InvalidTarget,
      message: 'Choose another player.',
    };
  }
  return { valid: true };
}
