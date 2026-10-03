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

function defaultSettings<TConfig, TSettings>(
  engine: Pick<GameEngine<unknown, unknown, TConfig, TSettings>, 'parseSettings' | 'gameType'>,
  config: TConfig,
): TSettings {
  const parsed = engine.parseSettings(undefined, config);
  if (!parsed.ok) throw new Error(`${engine.gameType} has no default settings: ${parsed.message}`);
  return parsed.settings;
}

/**
 * Replays a scripted match. Every intermediate state is frozen, so an engine that mutates
 * its input fails loudly.
 */
export function runMatch<TState, TAction, TConfig, TSettings>(
  engine: GameEngine<TState, TAction, TConfig, TSettings>,
  input: {
    seed: string;
    players: PlayerSeat[];
    actions: ScriptedAction<TAction>[];
    /** Defaults to the engine's own default. */
    config?: TConfig;
    /** Defaults to what the engine gives a room created without settings. */
    settings?: TSettings;
  },
): TState {
  const config = input.config ?? engine.defaultConfig;
  let state = deepFreeze(
    engine.createInitialState({
      gameId: 'test-game',
      players: input.players,
      seed: input.seed,
      config,
      settings: input.settings ?? defaultSettings(engine, config),
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
