import type { GameDefinition, GameModule } from '@bgp/game-core';
import { HARMONIES_GAME_TYPE, MAX_PLAYERS, MIN_PLAYERS } from './domain/config.js';
import { HarmoniesBot } from './bot/bot.js';
import { HarmoniesEngine } from './engine/engine.js';

export const HarmoniesDefinition: GameDefinition = {
  gameType: HARMONIES_GAME_TYPE,
  displayName: 'Harmonies',
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  supportsBots: true,
  supportsSpectators: true,
};

export const HarmoniesGame: GameModule<HarmoniesEngine> = {
  definition: HarmoniesDefinition,
  engine: new HarmoniesEngine(),
  bot: HarmoniesBot,
};

export { HarmoniesBot, HarmoniesEngine };
export { HARMONIES_GAME_TYPE } from './domain/config.js';
export { HarmoniesRuleCodes } from './domain/errors.js';
export { classifyStack } from './domain/board.js';
export { DEFAULT_HARMONIES_CONFIG } from './domain/game-config.js';
export type {
  HarmoniesConfig,
  HarmoniesMap,
  HarmoniesSettings,
  HarmoniesSetup,
  WaterScoring,
} from './domain/game-config.js';
export { hexKey, parseHexKey } from './domain/hex.js';
export { TOKEN_COLORS } from './domain/tokens.js';
export type { Hex } from './domain/hex.js';
export type { TokenColor } from './domain/tokens.js';
export type { Stack, Terrain, TerrainKind } from './domain/board.js';
export { getCubeCount } from './domain/cards.js';
export type { AnimalCard, CardTerrain, HabitatCell } from './domain/cards.js';
export type { HarmoniesAction } from './domain/actions.js';
export type { HarmoniesPhase, HarmoniesState, HarmoniesTurn } from './domain/state.js';
export { SCORING_RULES } from './scoring/score.js';
export type { ScoreBreakdown } from './scoring/score.js';
export type {
  HarmoniesView,
  LegalMovesView,
  PlayerBoardView,
  PlayerCardView,
} from './visibility/public-view.js';
