import type { GameValidationResult } from '@bgp/game-core';
import type { PlayerBoard } from '../domain/board.js';
import { HarmoniesRuleCodes } from '../domain/errors.js';
import type { HarmoniesState } from '../domain/state.js';
import { getLegalTokenCells } from './token-placement.rules.js';

export function validateCanAct(state: HarmoniesState, playerId: string): GameValidationResult {
  if (state.phase !== 'PLAYING') {
    return {
      valid: false,
      code: HarmoniesRuleCodes.GameNotPlaying,
      message: 'The game is not in progress.',
    };
  }
  if (state.turn.activePlayerId !== playerId) {
    return { valid: false, code: HarmoniesRuleCodes.NotYourTurn, message: 'It is not your turn.' };
  }
  return { valid: true };
}

export function getBoard(state: Pick<HarmoniesState, 'boards'>, playerId: string): PlayerBoard {
  const board = state.boards[playerId];
  if (!board) throw new Error(`No board for player ${playerId}`);
  return board;
}

export function hasTokensToTake(state: Pick<HarmoniesState, 'centralSpaces'>): boolean {
  return state.centralSpaces.some((space) => space.length > 0);
}

/** True while the active player still holds a token that fits somewhere on their board. */
export function hasPlaceableToken(state: HarmoniesState): boolean {
  const board = getBoard(state, state.turn.activePlayerId);
  return state.turn.hand.some((color) => getLegalTokenCells(state.config, board, color).length > 0);
}

/**
 * Taking and placing tokens is mandatory. A turn may only end once that is done; tokens that
 * fit nowhere are discarded.
 */
export function validateEndTurn(state: HarmoniesState): GameValidationResult {
  if (!state.turn.tokensTaken && hasTokensToTake(state)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.TokensNotTaken,
      message: 'Take tokens from the central board first.',
    };
  }
  if (hasPlaceableToken(state)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.TokensRemaining,
      message: 'Place all the tokens you took.',
    };
  }
  return { valid: true };
}

export function getNextPlayerId(
  state: Pick<HarmoniesState, 'turnOrder'>,
  playerId: string,
): string {
  const index = state.turnOrder.indexOf(playerId);
  const next = state.turnOrder[(index + 1) % state.turnOrder.length];
  if (index === -1 || next === undefined) throw new Error(`Unknown player ${playerId}`);
  return next;
}

export function isLastInRound(state: Pick<HarmoniesState, 'turnOrder'>, playerId: string): boolean {
  return state.turnOrder.at(-1) === playerId;
}
