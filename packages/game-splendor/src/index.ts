import type { GameDefinition, GameModule } from '@bgp/game-core';
import { MAX_PLAYERS, MIN_PLAYERS, SPLENDOR_GAME_TYPE } from './domain/config.js';
import { SplendorBot } from './bot/bot.js';
import { SplendorEngine } from './engine/engine.js';

export const SplendorDefinition: GameDefinition = {
  gameType: SPLENDOR_GAME_TYPE,
  displayName: 'Splendor',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  supportsBots: true,
  supportsSpectators: true,
};

export const SplendorGame: GameModule<SplendorEngine> = {
  definition: SplendorDefinition,
  engine: new SplendorEngine(),
  bot: SplendorBot,
};

export { SplendorBot, SplendorEngine };
export { MARKET_SIZE, MAX_RESERVED, SPLENDOR_GAME_TYPE, TOKEN_LIMIT } from './domain/config.js';
export { SplendorRuleCodes } from './domain/errors.js';
export { DEFAULT_SPLENDOR_CONFIG } from './domain/game-config.js';
export type {
  PlayerCountSetup,
  SplendorConfig,
  SplendorSettings,
  SplendorSetup,
} from './domain/game-config.js';
export { GEM_COLORS, GOLD, TOKEN_COLORS, countTokens } from './domain/gems.js';
export type { GemColor, GemCounts, TokenColor, TokenCounts } from './domain/gems.js';
export { TIERS } from './domain/cards.js';
export type { DevelopmentCard, Noble, Tier } from './domain/cards.js';
export type { SplendorAction } from './domain/actions.js';
export type { SplendorPhase, SplendorState, SplendorTurn, TurnStep } from './domain/state.js';
export type { LegalMoves } from './rules/legal-moves.js';
export type { CardShortfall } from './rules/purchase.rules.js';
export type { PlayerView, ReservedView, SplendorView } from './visibility/public-view.js';
