import type { GameDefinition, GameModule } from '@bgp/game-core';
import { AVALON_GAME_TYPE, MAX_PLAYERS, MIN_PLAYERS } from './domain/config.js';
import { AvalonEngine } from './engine/engine.js';

export const AvalonDefinition: GameDefinition = {
  gameType: AVALON_GAME_TYPE,
  displayName: 'Avalon',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  supportsBots: false,
  supportsSpectators: true,
};

export const AvalonGame: GameModule<AvalonEngine> = {
  definition: AvalonDefinition,
  engine: new AvalonEngine(),
};

export { AvalonEngine };
export {
  AVALON_GAME_TYPE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  QUESTS_TO_WIN,
  QUEST_COUNT,
} from './domain/config.js';
export { AvalonRuleCodes } from './domain/errors.js';
export {
  DEFAULT_AVALON_CONFIG,
  getRolesInPlay,
  minPlayersFor,
  validateSetup,
} from './domain/game-config.js';
export type {
  AvalonConfig,
  AvalonRules,
  AvalonSettings,
  PlayerCountSetup,
} from './domain/game-config.js';
export { OPTIONAL_ROLES, ROLES, alignmentOf } from './domain/roles.js';
export type { Alignment, OptionalRole, Role } from './domain/roles.js';
export type { AvalonAction } from './domain/actions.js';
export type { AvalonPhase, AvalonState } from './domain/state.js';
export type { Knowledge, Sighting } from './rules/knowledge.rules.js';
export type { LegalMoves } from './rules/legal-moves.js';
export type { Outcome, OutcomeReason } from './rules/outcome.rules.js';
export type {
  AvalonView,
  LadyInspectionView,
  LadyView,
  ProposalView,
  QuestResultView,
  QuestView,
  YouView,
} from './visibility/public-view.js';
