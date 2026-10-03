import { deepFreeze, seats } from '@bgp/game-core/testing';
import type { PlayerBoard, Stack } from '../../src/domain/board.js';
import type { HarmoniesState } from '../../src/domain/state.js';
import { HarmoniesGame } from '../../src/index.js';

export const engine = HarmoniesGame.engine;
export const config = engine.defaultConfig;
export const cards = config.cards;

export function boardWith(
  stacks: Record<string, Stack>,
  extra: Partial<Omit<PlayerBoard, 'stacks'>> = {},
): PlayerBoard {
  return { stacks, cubes: [], cards: [], ...extra };
}

export function context(actorPlayerId: string) {
  return { actorPlayerId, requestId: 'req', now: '2000-01-01T00:00:00.000Z' };
}

/** A fresh 2-player game, with optional overrides, frozen so mutation fails loudly. */
export function newGame(overrides: Partial<HarmoniesState> = {}, seed = 'fixture'): HarmoniesState {
  const state = engine.createInitialState({ gameId: 'g', players: seats(2), seed, config });
  return deepFreeze({ ...state, ...overrides });
}

export function active(state: HarmoniesState): string {
  return state.turn.activePlayerId;
}

export function withActiveBoard(state: HarmoniesState, board: PlayerBoard): HarmoniesState {
  return deepFreeze({ ...state, boards: { ...state.boards, [active(state)]: board } });
}
