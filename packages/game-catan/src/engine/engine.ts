import type {
  CreateInitialStateInput,
  GameActionContext,
  GameEngine,
  GameResult,
  GameStatus,
  GameValidationResult,
  GameViewer,
  ParseActionResult,
  ParseConfigResult,
  ParseSettingsResult,
} from '@bgp/game-core';
import type { CatanAction } from '../domain/actions.js';
import { CATAN_ENGINE_VERSION, CATAN_GAME_TYPE } from '../domain/config.js';
import {
  DEFAULT_CATAN_CONFIG,
  parseConfig,
  parseSettings,
  type CatanConfig,
  type CatanSettings,
} from '../domain/game-config.js';
import type { CatanState } from '../domain/state.js';
import { getActingPlayerIds } from '../rules/turn.rules.js';
import { calculateScores } from '../scoring/score.js';
import { getPublicView, type CatanView } from '../visibility/public-view.js';
import { applyAction } from './apply-action.js';
import { createInitialState } from './create-initial-state.js';
import { parseAction } from './parse-action.js';
import { validateAction } from './validate-action.js';

export class CatanEngine implements GameEngine<
  CatanState,
  CatanAction,
  CatanConfig,
  CatanSettings
> {
  readonly gameType = CATAN_GAME_TYPE;
  readonly engineVersion = CATAN_ENGINE_VERSION;

  readonly defaultConfig = DEFAULT_CATAN_CONFIG;

  parseConfig(raw: unknown): ParseConfigResult<CatanConfig> {
    return parseConfig(raw);
  }

  parseSettings(raw: unknown, config: CatanConfig): ParseSettingsResult<CatanSettings> {
    return parseSettings(raw, config);
  }

  createInitialState(input: CreateInitialStateInput<CatanConfig, CatanSettings>): CatanState {
    return createInitialState(input);
  }

  parseAction(raw: unknown): ParseActionResult<CatanAction> {
    return parseAction(raw);
  }

  validateAction(
    state: CatanState,
    action: CatanAction,
    context: GameActionContext,
  ): GameValidationResult {
    return validateAction(state, action, context);
  }

  applyAction(state: CatanState, action: CatanAction, context: GameActionContext): CatanState {
    return applyAction(state, action, context);
  }

  getGameStatus(state: CatanState): GameStatus {
    return state.phase === 'FINISHED' ? 'finished' : 'playing';
  }

  /** More than one player after a 7 or while a trade offer is open. */
  getCurrentPlayerIds(state: CatanState): string[] {
    return getActingPlayerIds(state);
  }

  getResult(state: CatanState): GameResult | null {
    if (state.phase !== 'FINISHED') return null;
    return { winnerPlayerIds: [...state.winnerPlayerIds], scores: calculateScores(state) };
  }

  getPublicView(state: CatanState, viewer: GameViewer): CatanView {
    return getPublicView(state, viewer);
  }
}
