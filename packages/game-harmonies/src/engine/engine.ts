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
} from '@bgp/game-core';
import type { HarmoniesAction } from '../domain/actions.js';
import { HARMONIES_ENGINE_VERSION, HARMONIES_GAME_TYPE } from '../domain/config.js';
import {
  DEFAULT_HARMONIES_CONFIG,
  parseConfig,
  type HarmoniesConfig,
} from '../domain/game-config.js';
import type { HarmoniesState } from '../domain/state.js';
import { calculateScores } from '../scoring/score.js';
import { getPublicView, type HarmoniesView } from '../visibility/public-view.js';
import { applyAction } from './apply-action.js';
import { createInitialState } from './create-initial-state.js';
import { parseAction } from './parse-action.js';
import { validateAction } from './validate-action.js';

export class HarmoniesEngine implements GameEngine<
  HarmoniesState,
  HarmoniesAction,
  HarmoniesConfig
> {
  readonly gameType = HARMONIES_GAME_TYPE;
  readonly engineVersion = HARMONIES_ENGINE_VERSION;

  readonly defaultConfig = DEFAULT_HARMONIES_CONFIG;

  parseConfig(raw: unknown): ParseConfigResult<HarmoniesConfig> {
    return parseConfig(raw);
  }

  createInitialState(input: CreateInitialStateInput<HarmoniesConfig>): HarmoniesState {
    return createInitialState(input);
  }

  parseAction(raw: unknown): ParseActionResult<HarmoniesAction> {
    return parseAction(raw);
  }

  validateAction(
    state: HarmoniesState,
    action: HarmoniesAction,
    context: GameActionContext,
  ): GameValidationResult {
    return validateAction(state, action, context);
  }

  applyAction(
    state: HarmoniesState,
    action: HarmoniesAction,
    context: GameActionContext,
  ): HarmoniesState {
    return applyAction(state, action, context);
  }

  getGameStatus(state: HarmoniesState): GameStatus {
    return state.phase === 'FINISHED' ? 'finished' : 'playing';
  }

  getCurrentPlayerIds(state: HarmoniesState): string[] {
    return state.phase === 'PLAYING' ? [state.turn.activePlayerId] : [];
  }

  getResult(state: HarmoniesState): GameResult | null {
    if (state.phase !== 'FINISHED') return null;
    const scores = calculateScores(state);
    return {
      winnerPlayerIds: [...state.winnerPlayerIds],
      scores: Object.fromEntries(
        Object.entries(scores).map(([playerId, score]) => [playerId, score.total]),
      ),
    };
  }

  getPublicView(state: HarmoniesState, viewer: GameViewer): HarmoniesView {
    return getPublicView(state, viewer);
  }
}
