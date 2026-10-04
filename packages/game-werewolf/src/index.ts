import type { GameDefinition, GameModule } from '@bgp/game-core';
import { WerewolfBot } from './bot/bot.js';
import { MAX_PLAYERS, MIN_PLAYERS, WEREWOLF_GAME_TYPE } from './domain/config.js';
import { WerewolfEngine } from './engine/engine.js';

export const WerewolfDefinition: GameDefinition = {
  gameType: WEREWOLF_GAME_TYPE,
  displayName: 'Ma Sói',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  supportsBots: true,
  supportsSpectators: true,
};

export const WerewolfGame: GameModule<WerewolfEngine> = {
  definition: WerewolfDefinition,
  engine: new WerewolfEngine(),
  bot: WerewolfBot,
};

export { WerewolfBot, WerewolfEngine };
export { MAX_PLAYERS, MIN_PLAYERS, WEREWOLF_GAME_TYPE } from './domain/config.js';
export { CompositionCodes, WerewolfRuleCodes } from './domain/errors.js';
export type { CompositionCode } from './domain/errors.js';
export {
  DEFAULT_WEREWOLF_CONFIG,
  checkComposition,
  fillSpecialRoles,
  resolveRoles,
  selectedRoles,
} from './domain/game-config.js';
export type {
  CompositionResult,
  RoleLimit,
  WerewolfConfig,
  WerewolfRules,
  WerewolfSettings,
  WerewolfSetup,
} from './domain/game-config.js';
export { ROLES, ROLE_IDS, SPECIAL_ROLE_IDS, isWolf } from './domain/roles.js';
export type {
  Faction,
  RoleCounts,
  RoleId,
  SpecialRoleCounts,
  SpecialRoleId,
} from './domain/roles.js';
export type { WerewolfAction, WerewolfActionType } from './domain/actions.js';
export type {
  Inspection,
  LogEntry,
  NightStep,
  WerewolfPhase,
  WerewolfState,
  Winner,
} from './domain/state.js';
export type { LegalMoves } from './rules/legal-moves.js';
export type { MyView, PlayerView, WerewolfView } from './visibility/public-view.js';
