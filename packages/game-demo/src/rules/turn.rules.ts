import type { GameValidationResult } from '@bgp/game-core';
import { GridClaimRuleCodes } from '../domain/errors.js';
import type { GridClaimState } from '../domain/state.js';

export function validateCanAct(state: GridClaimState, playerId: string): GameValidationResult {
  if (state.phase !== 'PLAYING') {
    return {
      valid: false,
      code: GridClaimRuleCodes.GameNotPlaying,
      message: 'The game is not in progress.',
    };
  }
  if (state.turn.activePlayerId !== playerId) {
    return {
      valid: false,
      code: GridClaimRuleCodes.NotYourTurn,
      message: 'It is not your turn.',
    };
  }
  return { valid: true };
}

export function getOpponentId(state: Pick<GridClaimState, 'playerIds'>, playerId: string): string {
  const opponent = state.playerIds.find((candidate) => candidate !== playerId);
  if (opponent === undefined) throw new Error(`No opponent for player ${playerId}`);
  return opponent;
}
