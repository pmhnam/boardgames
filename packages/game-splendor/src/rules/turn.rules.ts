import type { GameValidationResult } from '@bgp/game-core';
import { SplendorRuleCodes } from '../domain/errors.js';
import type { PlayerState, SplendorState, TurnStep } from '../domain/state.js';

export function validateCanAct(state: SplendorState, playerId: string): GameValidationResult {
  if (state.phase !== 'PLAYING') {
    return {
      valid: false,
      code: SplendorRuleCodes.GameNotPlaying,
      message: 'The game is not in progress.',
    };
  }
  if (state.turn.activePlayerId !== playerId) {
    return { valid: false, code: SplendorRuleCodes.NotYourTurn, message: 'It is not your turn.' };
  }
  return { valid: true };
}

const STEP_INSTRUCTIONS: Record<TurnStep, string> = {
  ACTION: 'Take gems, reserve a card or buy a card.',
  RETURN_GEMS: 'Return tokens down to the limit first.',
  CHOOSE_NOBLE: 'Choose which noble visits you first.',
};

export function validateStep(state: Pick<SplendorState, 'turn'>, step: TurnStep) {
  if (state.turn.step !== step) {
    return {
      valid: false as const,
      code: SplendorRuleCodes.WrongStep,
      message: STEP_INSTRUCTIONS[state.turn.step],
    };
  }
  return { valid: true as const };
}

export function getPlayer(state: Pick<SplendorState, 'players'>, playerId: string): PlayerState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

export function getNextPlayerId(state: Pick<SplendorState, 'turnOrder'>, playerId: string): string {
  const index = state.turnOrder.indexOf(playerId);
  const next = state.turnOrder[(index + 1) % state.turnOrder.length];
  if (index === -1 || next === undefined) throw new Error(`Unknown player ${playerId}`);
  return next;
}

export function isLastInRound(state: Pick<SplendorState, 'turnOrder'>, playerId: string): boolean {
  return state.turnOrder.at(-1) === playerId;
}
