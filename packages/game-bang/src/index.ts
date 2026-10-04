import type { GameDefinition, GameModule } from '@bgp/game-core';
import { BANG_GAME_TYPE, MAX_PLAYERS, MIN_PLAYERS } from './domain/config.js';
import { BangBot } from './bot/bot.js';
import { BangEngine } from './engine/engine.js';

export const BangDefinition: GameDefinition = {
  gameType: BANG_GAME_TYPE,
  displayName: 'BANG!',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  supportsBots: true,
  supportsSpectators: true,
};

export const BangGame: GameModule<BangEngine> = {
  definition: BangDefinition,
  engine: new BangEngine(),
  bot: BangBot,
};

export { BangBot, BangEngine };
export { BANG_GAME_TYPE, MAX_PLAYERS, MIN_PLAYERS } from './domain/config.js';
export { BangRuleCodes } from './domain/errors.js';
export { CARD_KINDS, SUITS, isBlue, isWeapon } from './domain/cards.js';
export type { Card, CardKind, Suit } from './domain/cards.js';
export { CHARACTER_IDS } from './domain/characters.js';
export type { CharacterId } from './domain/characters.js';
export { ROLE_IDS } from './domain/roles.js';
export type { RoleCounts, RoleId, Winner } from './domain/roles.js';
export { DEFAULT_BANG_CONFIG } from './domain/game-config.js';
export type {
  BangConfig,
  BangRules,
  BangSettings,
  BangSetup,
  CharacterConfig,
} from './domain/game-config.js';
export type { BangAction, BangActionType } from './domain/actions.js';
export type { BangPhase, BangState, CheckReason, DiscardReason, Pending } from './domain/state.js';
export type { LegalMoves, PlayOption, Prompt } from './rules/legal-moves.js';
export type {
  BangView,
  CardView,
  LogEntryView,
  MyView,
  PendingView,
  PlayerView,
} from './visibility/public-view.js';
