import type { GameDefinition, GameModule } from '@bgp/game-core';
import { GRID_CLAIM_GAME_TYPE, PLAYER_COUNT } from './domain/config.js';
import { GridClaimEngine } from './engine/engine.js';

export const GridClaimDefinition: GameDefinition = {
  gameType: GRID_CLAIM_GAME_TYPE,
  displayName: 'Grid Claim',
  minPlayers: PLAYER_COUNT,
  maxPlayers: PLAYER_COUNT,
  supportsBots: false,
  supportsSpectators: true,
};

export const GridClaimGame: GameModule<GridClaimEngine> = {
  definition: GridClaimDefinition,
  engine: new GridClaimEngine(),
};

export { GridClaimEngine };
export { DEFAULT_GRID_CLAIM_CONFIG, GRID_CLAIM_GAME_TYPE } from './domain/config.js';
export type { GridClaimConfig } from './domain/config.js';
export { GridClaimRuleCodes } from './domain/errors.js';
export { BLOCKED } from './domain/board.js';
export type { Cell, Position } from './domain/board.js';
export type { GridClaimAction, PlacePieceAction } from './domain/actions.js';
export type { GridClaimPhase, GridClaimState } from './domain/state.js';
export type { GridClaimView } from './visibility/public-view.js';
