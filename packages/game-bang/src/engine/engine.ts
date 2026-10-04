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
import type { BangAction } from '../domain/actions.js';
import { BANG_ENGINE_VERSION, BANG_GAME_TYPE } from '../domain/config.js';
import {
  DEFAULT_BANG_CONFIG,
  parseConfig,
  parseSettings,
  type BangConfig,
  type BangSettings,
} from '../domain/game-config.js';
import type { BangState } from '../domain/state.js';
import { getOwingPlayerId } from '../rules/players.js';
import { getPublicView, type BangView } from '../visibility/public-view.js';
import { applyAction } from './apply-action.js';
import { createInitialState } from './create-initial-state.js';
import { parseAction } from './parse-action.js';
import { validateAction } from './validate-action.js';

export class BangEngine implements GameEngine<BangState, BangAction, BangConfig, BangSettings> {
  readonly gameType = BANG_GAME_TYPE;
  readonly engineVersion = BANG_ENGINE_VERSION;

  readonly defaultConfig = DEFAULT_BANG_CONFIG;

  parseConfig(raw: unknown): ParseConfigResult<BangConfig> {
    return parseConfig(raw);
  }

  parseSettings(raw: unknown): ParseSettingsResult<BangSettings> {
    return parseSettings(raw);
  }

  createInitialState(input: CreateInitialStateInput<BangConfig, BangSettings>): BangState {
    return createInitialState(input);
  }

  parseAction(raw: unknown): ParseActionResult<BangAction> {
    return parseAction(raw);
  }

  validateAction(
    state: BangState,
    action: BangAction,
    context: GameActionContext,
  ): GameValidationResult {
    return validateAction(state, action, context);
  }

  applyAction(state: BangState, action: BangAction, context: GameActionContext): BangState {
    return applyAction(state, action, context);
  }

  getGameStatus(state: BangState): GameStatus {
    return state.phase === 'FINISHED' ? 'finished' : 'playing';
  }

  /** One player at a time, even when a card asks something of the whole table. */
  getCurrentPlayerIds(state: BangState): string[] {
    const playerId = getOwingPlayerId(state);
    return playerId === null ? [] : [playerId];
  }

  getResult(state: BangState): GameResult | null {
    if (state.phase !== 'FINISHED') return null;
    return { winnerPlayerIds: [...state.winnerPlayerIds] };
  }

  getPublicView(state: BangState, viewer: GameViewer): BangView {
    return getPublicView(state, viewer);
  }
}
