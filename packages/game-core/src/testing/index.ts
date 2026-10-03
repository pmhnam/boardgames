import type { GameEngine, PlayerSeat } from '../contracts/engine.js';

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function seats(count: number): PlayerSeat[] {
  return Array.from({ length: count }, (_, seat) => ({ playerId: `p${seat + 1}`, seat }));
}

export interface ScriptedAction<TAction> {
  playerId: string;
  action: TAction;
}

/**
 * Replays a scripted match. Every intermediate state is frozen, so an engine that mutates
 * its input fails loudly.
 */
export function runMatch<TState, TAction, TConfig>(
  engine: GameEngine<TState, TAction, TConfig>,
  input: {
    seed: string;
    players: PlayerSeat[];
    actions: ScriptedAction<TAction>[];
    /** Defaults to the engine's own default. */
    config?: TConfig;
  },
): TState {
  let state = deepFreeze(
    engine.createInitialState({
      gameId: 'test-game',
      players: input.players,
      seed: input.seed,
      config: input.config ?? engine.defaultConfig,
    }),
  );
  input.actions.forEach((step, index) => {
    state = deepFreeze(
      engine.applyAction(state, step.action, {
        actorPlayerId: step.playerId,
        requestId: `req-${index}`,
        now: '2000-01-01T00:00:00.000Z',
      }),
    );
  });
  return state;
}
