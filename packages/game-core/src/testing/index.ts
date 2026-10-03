import type { BotLevel, BotStrategy } from '../contracts/bot.js';
import type { GameEngine, PlayerSeat } from '../contracts/engine.js';
import { createSeededRandom } from '../random/seeded-random.js';

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

export interface BotMatchResult<TState> {
  state: TState;
  /** How many actions the bots took between them. */
  actionCount: number;
}

/**
 * Plays a whole match with bots in every seat, the way the platform drives them: each decision
 * is made from that seat's own view, then parsed, validated and applied like a human's. Throws
 * if a bot ever picks an illegal action or the match does not end.
 */
export function playBotMatch<TState, TAction, TConfig, TSettings>(
  engine: GameEngine<TState, TAction, TConfig, TSettings>,
  bot: BotStrategy<unknown, unknown>,
  input: {
    seed: string;
    /** One level per seat, in seat order. */
    levels: BotLevel[];
    config?: TConfig;
    settings?: TSettings;
    maxActions?: number;
  },
): BotMatchResult<TState> {
  const config = input.config ?? engine.defaultConfig;
  const players = seats(input.levels.length);
  const levelOf = new Map(players.map((player, index) => [player.playerId, input.levels[index]]));
  const maxActions = input.maxActions ?? 5000;

  let state = deepFreeze(
    engine.createInitialState({
      gameId: 'bot-match',
      players,
      seed: input.seed,
      config,
      settings: input.settings ?? defaultSettings(engine, config),
    }),
  );

  let actionCount = 0;
  while (engine.getGameStatus(state) === 'playing') {
    if (actionCount >= maxActions)
      throw new Error(`Bot match did not end in ${maxActions} actions`);
    const playerId = engine.getCurrentPlayerIds(state)[0];
    const level = playerId === undefined ? undefined : levelOf.get(playerId);
    if (playerId === undefined || level === undefined) throw new Error('No bot to move');

    const chosen = bot.chooseAction({
      view: engine.getPublicView(state, { type: 'player', playerId }),
      playerId,
      level,
      random: createSeededRandom(`${input.seed}:${actionCount}`),
    });
    const parsed = engine.parseAction(chosen);
    if (!parsed.ok) throw new Error(`Bot (${level}) sent a malformed action: ${parsed.message}`);

    const context = {
      actorPlayerId: playerId,
      requestId: `bot-${actionCount}`,
      now: '2000-01-01T00:00:00.000Z',
    };
    const validation = engine.validateAction(state, parsed.action, context);
    if (!validation.valid) {
      throw new Error(
        `Bot (${level}) chose an illegal action ${JSON.stringify(parsed.action)}: ${validation.code}`,
      );
    }
    state = deepFreeze(engine.applyAction(state, parsed.action, context));
    actionCount += 1;
  }

  return { state, actionCount };
}
