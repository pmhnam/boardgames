import type { GameEngine, PlayerSeat } from './engine.js';

export interface GameDefinition {
  gameType: string;
  displayName: string;

  minPlayers: number;
  maxPlayers: number;

  supportsBots: boolean;
  supportsSpectators: boolean;

  settingsSchema?: unknown;
}

/**
 * The registry boundary: the platform handles games without knowing their state or action types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameEngine = GameEngine<any, any, any, PlayerSeat>;

export interface GameModule<TEngine extends AnyGameEngine = AnyGameEngine> {
  definition: GameDefinition;
  engine: TEngine;
}
