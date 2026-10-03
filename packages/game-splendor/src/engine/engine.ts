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
import type { SplendorAction } from '../domain/actions.js';
import { SPLENDOR_ENGINE_VERSION, SPLENDOR_GAME_TYPE } from '../domain/config.js';
import {
  DEFAULT_SPLENDOR_CONFIG,
  parseConfig,
  parseSettings,
  type SplendorConfig,
  type SplendorSettings,
} from '../domain/game-config.js';
import type { SplendorState } from '../domain/state.js';
import { calculateScores } from '../scoring/score.js';
import { getPublicView, type SplendorView } from '../visibility/public-view.js';
import { applyAction } from './apply-action.js';
import { createInitialState } from './create-initial-state.js';
import { parseAction } from './parse-action.js';
import { validateAction } from './validate-action.js';

export class SplendorEngine implements GameEngine<
  SplendorState,
  SplendorAction,
  SplendorConfig,
  SplendorSettings
> {
  readonly gameType = SPLENDOR_GAME_TYPE;
  readonly engineVersion = SPLENDOR_ENGINE_VERSION;

  readonly defaultConfig = DEFAULT_SPLENDOR_CONFIG;

  parseConfig(raw: unknown): ParseConfigResult<SplendorConfig> {
    return parseConfig(raw);
  }

  parseSettings(raw: unknown, config: SplendorConfig): ParseSettingsResult<SplendorSettings> {
    return parseSettings(raw, config);
  }

  createInitialState(
    input: CreateInitialStateInput<SplendorConfig, SplendorSettings>,
  ): SplendorState {
    return createInitialState(input);
  }

  parseAction(raw: unknown): ParseActionResult<SplendorAction> {
    return parseAction(raw);
  }

  validateAction(
    state: SplendorState,
    action: SplendorAction,
    context: GameActionContext,
  ): GameValidationResult {
    return validateAction(state, action, context);
  }

  applyAction(
    state: SplendorState,
    action: SplendorAction,
    context: GameActionContext,
  ): SplendorState {
    return applyAction(state, action, context);
  }

  getGameStatus(state: SplendorState): GameStatus {
    return state.phase === 'FINISHED' ? 'finished' : 'playing';
  }

  getCurrentPlayerIds(state: SplendorState): string[] {
    return state.phase === 'PLAYING' ? [state.turn.activePlayerId] : [];
  }

  getResult(state: SplendorState): GameResult | null {
    if (state.phase !== 'FINISHED') return null;
    return { winnerPlayerIds: [...state.winnerPlayerIds], scores: calculateScores(state) };
  }

  getPublicView(state: SplendorState, viewer: GameViewer): SplendorView {
    return getPublicView(state, viewer);
  }
}
