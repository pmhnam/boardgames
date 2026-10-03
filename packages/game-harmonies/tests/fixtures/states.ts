import { deepFreeze, seats } from '@bgp/game-core/testing';
import type { PlayerBoard, Stack } from '../../src/domain/board.js';
import type { HarmoniesState } from '../../src/domain/state.js';
import { resolveSetup } from '../../src/domain/game-config.js';
import { HarmoniesGame, type HarmoniesSettings } from '../../src/index.js';

export const engine = HarmoniesGame.engine;
/** What is stored in the database: every map, the deck, the pouch. */
export const gameConfig = engine.defaultConfig;

export const MAP_A: HarmoniesSettings = { mapId: 'A' };
export const MAP_B: HarmoniesSettings = { mapId: 'B' };

/** What one match plays by. Unless a test says otherwise, that is side A. */
export const config = resolveSetup(gameConfig, MAP_A);
export const setupB = resolveSetup(gameConfig, MAP_B);
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
  const state = engine.createInitialState({
    gameId: 'g',
    players: seats(2),
    seed,
    config: gameConfig,
    settings: MAP_A,
  });
  return deepFreeze({ ...state, ...overrides });
}

export function active(state: HarmoniesState): string {
  return state.turn.activePlayerId;
}

export function withActiveBoard(state: HarmoniesState, board: PlayerBoard): HarmoniesState {
  return deepFreeze({ ...state, boards: { ...state.boards, [active(state)]: board } });
}
