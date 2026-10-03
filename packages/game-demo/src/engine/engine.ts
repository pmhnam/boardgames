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
import type { GridClaimAction } from '../domain/actions.js';
import {
  DEFAULT_GRID_CLAIM_CONFIG,
  GRID_CLAIM_ENGINE_VERSION,
  GRID_CLAIM_GAME_TYPE,
  parseConfig,
  type GridClaimConfig,
  type GridClaimSettings,
} from '../domain/config.js';
import type { GridClaimState } from '../domain/state.js';
import { calculateScores } from '../scoring/score.js';
import { getPublicView, type GridClaimView } from '../visibility/public-view.js';
import { applyAction } from './apply-action.js';
import { createInitialState } from './create-initial-state.js';
import { parseAction } from './parse-action.js';
import { validateAction } from './validate-action.js';

export class GridClaimEngine implements GameEngine<
  GridClaimState,
  GridClaimAction,
  GridClaimConfig,
  GridClaimSettings
> {
  readonly gameType = GRID_CLAIM_GAME_TYPE;
  readonly engineVersion = GRID_CLAIM_ENGINE_VERSION;

  readonly defaultConfig = DEFAULT_GRID_CLAIM_CONFIG;

  parseConfig(raw: unknown): ParseConfigResult<GridClaimConfig> {
    return parseConfig(raw);
  }

  parseSettings(): ParseSettingsResult<GridClaimSettings> {
    return { ok: true, settings: {} };
  }

  createInitialState(
    input: CreateInitialStateInput<GridClaimConfig, GridClaimSettings>,
  ): GridClaimState {
    return createInitialState(input);
  }

  parseAction(raw: unknown): ParseActionResult<GridClaimAction> {
    return parseAction(raw);
  }

  validateAction(
    state: GridClaimState,
    action: GridClaimAction,
    context: GameActionContext,
  ): GameValidationResult {
    return validateAction(state, action, context);
  }

  applyAction(
    state: GridClaimState,
    action: GridClaimAction,
    context: GameActionContext,
  ): GridClaimState {
    return applyAction(state, action, context);
  }

  getGameStatus(state: GridClaimState): GameStatus {
    return state.phase === 'FINISHED' ? 'finished' : 'playing';
  }

  getCurrentPlayerIds(state: GridClaimState): string[] {
    return state.phase === 'PLAYING' ? [state.turn.activePlayerId] : [];
  }

  getResult(state: GridClaimState): GameResult | null {
    if (state.phase !== 'FINISHED') return null;
    return { winnerPlayerIds: [...state.winnerPlayerIds], scores: calculateScores(state) };
  }

  getPublicView(state: GridClaimState, viewer: GameViewer): GridClaimView {
    return getPublicView(state, viewer);
  }
}
