import type { GameId, PlayerId } from './ids.js';

export interface GameActionContext {
  actorPlayerId: PlayerId;
  requestId: string;
  /** ISO timestamp supplied by the platform. Engines must not read the clock themselves. */
  now: string;
}

export type GameStatus = 'waiting' | 'playing' | 'finished' | 'cancelled';

export type GameValidationResult =
  | { valid: true }
  | {
      valid: false;
      code: string;
      message: string;
    };

export type GameViewer =
  { type: 'player'; playerId: PlayerId } | { type: 'spectator' } | { type: 'admin' };

/** What the platform tells a game about each seated player. */
export interface PlayerSeat {
  playerId: PlayerId;
  seat: number;
}

export interface CreateInitialStateInput<
  TConfig = unknown,
  TSettings = unknown,
  TPlayerConfig = PlayerSeat,
> {
  gameId: GameId;
  players: TPlayerConfig[];
  seed: string;
  /**
   * The game's tunable data (board, pieces, cards...), already checked by `parseConfig`.
   * An engine that needs it after setup must copy it into its state: this is the only time
   * the platform hands it over.
   */
  config: TConfig;
  /** The choices made for this one match (which map, which variant...), from `parseSettings`. */
  settings: TSettings;
}

export type ParseSettingsResult<TSettings> =
  { ok: true; settings: TSettings } | { ok: false; message: string };

export type ParseConfigResult<TConfig> =
  { ok: true; config: TConfig } | { ok: false; message: string };

export type ParseActionResult<TAction> =
  { ok: true; action: TAction } | { ok: false; message: string };

export interface GameResult {
  winnerPlayerIds: PlayerId[];
  scores?: Record<PlayerId, number>;
}

/**
 * A game's rules. Implementations must be pure and deterministic:
 * same initial input + same actions => same state. No I/O, no clock, no Math.random.
 */
export interface GameEngine<
  TState,
  TAction,
  TConfig = unknown,
  TSettings = unknown,
  TPlayerConfig = PlayerSeat,
> {
  readonly gameType: string;
  readonly engineVersion: number;

  /** The configuration a fresh installation starts with. */
  readonly defaultConfig: TConfig;

  /**
   * Validates configuration from an untrusted source (an admin request, a database row).
   * Must reject anything the engine could not run a whole game on.
   */
  parseConfig(raw: unknown): ParseConfigResult<TConfig>;

  /**
   * Validates what a room's host chose for a match, against the config those choices refer to.
   * `undefined` must yield the defaults, so a room created without settings is always playable.
   */
  parseSettings(raw: unknown, config: TConfig): ParseSettingsResult<TSettings>;

  createInitialState(input: CreateInitialStateInput<TConfig, TSettings, TPlayerConfig>): TState;

  /** Runtime shape check of an untrusted payload. Says nothing about legality. */
  parseAction(raw: unknown): ParseActionResult<TAction>;

  validateAction(
    state: Readonly<TState>,
    action: Readonly<TAction>,
    context: GameActionContext,
  ): GameValidationResult;

  /** Returns a new state. Throws GameRuleError if the action is illegal. */
  applyAction(
    state: Readonly<TState>,
    action: Readonly<TAction>,
    context: GameActionContext,
  ): TState;

  getGameStatus(state: Readonly<TState>): GameStatus;

  getCurrentPlayerIds(state: Readonly<TState>): PlayerId[];

  /** Null until the game is finished. */
  getResult(state: Readonly<TState>): GameResult | null;

  getPublicView(state: Readonly<TState>, viewer: GameViewer): unknown;
}
