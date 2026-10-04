import type { GameDefinition, GameModule } from '@bgp/game-core';
import { CatanBot } from './bot/bot.js';
import { CATAN_GAME_TYPE, MAX_PLAYERS, MIN_PLAYERS } from './domain/config.js';
import { CatanEngine } from './engine/engine.js';

export const CatanDefinition: GameDefinition = {
  gameType: CATAN_GAME_TYPE,
  displayName: 'CATAN',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  supportsBots: true,
  supportsSpectators: true,
};

export const CatanGame: GameModule<CatanEngine> = {
  definition: CatanDefinition,
  engine: new CatanEngine(),
  bot: CatanBot,
};

export { CatanBot, CatanEngine };
export { CATAN_GAME_TYPE } from './domain/config.js';
export { CatanRuleCodes } from './domain/errors.js';
export { BOARD_SETUPS, DEFAULT_CATAN_CONFIG } from './domain/game-config.js';
export type {
  BoardSetup,
  CatanConfig,
  CatanSettings,
  CatanSetup,
  Costs,
  Harbor,
  Pieces,
} from './domain/game-config.js';
export type { HarborPlacement, HarborType, Tile } from './domain/default-board.js';
export { DEVELOPMENT_CARD_TYPES } from './domain/development-cards.js';
export type { DevelopmentCardType, PlayableCardType } from './domain/development-cards.js';
export { hexKey, parseEdgeId, parseHexKey, parseVertexId } from './domain/hex.js';
export type { Hex, VertexCorner } from './domain/hex.js';
export { RESOURCES, TERRAINS, TERRAIN_RESOURCE, countResources } from './domain/resources.js';
export type { Resource, ResourceCounts, Terrain } from './domain/resources.js';
export { buildTopology } from './domain/topology.js';
export type { Topology } from './domain/topology.js';
export type { CatanAction } from './domain/actions.js';
export type {
  Building,
  BuildingKind,
  CatanPhase,
  CatanState,
  CatanTurn,
  TradeResponse,
  TurnStep,
} from './domain/state.js';
export type { LegalMoves } from './rules/legal-moves.js';
export type {
  CatanView,
  HeldCardView,
  HexView,
  OfferView,
  PlayerView,
  TurnView,
} from './visibility/public-view.js';
