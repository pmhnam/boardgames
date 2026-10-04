import type { GameValidationResult } from '@bgp/game-core';
import { SETUP_ROUNDS } from '../domain/config.js';
import { CatanRuleCodes, VALID, invalid } from '../domain/errors.js';
import type { CatanState, PlayerState, TurnStep } from '../domain/state.js';

export function getPlayer(state: Pick<CatanState, 'players'>, playerId: string): PlayerState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

export function getNextPlayerId(state: Pick<CatanState, 'turnOrder'>, playerId: string): string {
  const index = state.turnOrder.indexOf(playerId);
  const next = state.turnOrder[(index + 1) % state.turnOrder.length];
  if (index === -1 || next === undefined) throw new Error(`Unknown player ${playerId}`);
  return next;
}

/** How many turns the opening takes: every player places once per round. */
export function getSetupTurns(state: Pick<CatanState, 'turnOrder'>): number {
  return SETUP_ROUNDS * state.turnOrder.length;
}

/** Who places on a turn of the opening. Each round runs in the reverse order of the last. */
export function getSetupPlayerId(turnOrder: readonly string[], turnNumber: number): string {
  const index = turnNumber - 1;
  const round = Math.floor(index / turnOrder.length);
  const position = index % turnOrder.length;
  const playerId = turnOrder[round % 2 === 0 ? position : turnOrder.length - 1 - position];
  if (playerId === undefined) throw new Error(`No player for setup turn ${turnNumber}`);
  return playerId;
}

/** The settlement placed in the last round of the opening collects from the hexes around it. */
export function isLastSetupRound(state: Pick<CatanState, 'turnOrder' | 'turn'>): boolean {
  return state.turn.number > (SETUP_ROUNDS - 1) * state.turnOrder.length;
}

/** The players the open offer is still waiting on, in seat order. */
export function getPendingResponders(state: Pick<CatanState, 'turnOrder' | 'turn'>): string[] {
  const { offer, activePlayerId } = state.turn;
  if (!offer) return [];
  return state.turnOrder.filter(
    (playerId) => playerId !== activePlayerId && offer.responses[playerId] === undefined,
  );
}

/**
 * Everyone who may act now. Usually the active player alone; after a 7 it is everyone who owes
 * cards, and while an offer is open it is whoever has not answered, then the active player.
 */
export function getActingPlayerIds(state: CatanState): string[] {
  if (state.phase !== 'PLAYING') return [];
  if (state.turn.step === 'DISCARD') {
    return state.turnOrder.filter((playerId) => (state.turn.pendingDiscards[playerId] ?? 0) > 0);
  }
  return [...getPendingResponders(state), state.turn.activePlayerId];
}

export function validateIsActive(
  state: Pick<CatanState, 'turn'>,
  playerId: string,
): GameValidationResult {
  if (state.turn.activePlayerId !== playerId) {
    return invalid(CatanRuleCodes.NotYourTurn, 'It is not your turn.');
  }
  return VALID;
}

const STEP_INSTRUCTIONS: Record<TurnStep, string> = {
  SETUP_SETTLEMENT: 'Place a settlement first.',
  SETUP_ROAD: 'Place a road from the settlement you just placed.',
  ROLL: 'Roll the dice first.',
  DISCARD: 'Wait for everyone to discard.',
  ROBBER: 'Move the robber first.',
  MAIN: 'The dice have already been rolled.',
};

export function validateStep(
  state: Pick<CatanState, 'turn'>,
  ...steps: TurnStep[]
): GameValidationResult {
  if (!steps.includes(state.turn.step)) {
    return invalid(CatanRuleCodes.WrongStep, STEP_INSTRUCTIONS[state.turn.step]);
  }
  return VALID;
}

/** Nothing else may happen while an offer is open or free roads are waiting to be placed. */
export function validateNothingPending(state: Pick<CatanState, 'turn'>): GameValidationResult {
  if (state.turn.offer) {
    return invalid(CatanRuleCodes.OfferPending, 'Close your trade offer first.');
  }
  if (state.turn.freeRoads > 0) {
    return invalid(CatanRuleCodes.RoadsPending, 'Place your free roads first.');
  }
  return VALID;
}
