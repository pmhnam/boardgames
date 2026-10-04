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
  ValidateSetupInput,
} from '@bgp/game-core';
import type { AvalonAction } from '../domain/actions.js';
import { AVALON_ENGINE_VERSION, AVALON_GAME_TYPE } from '../domain/config.js';
import {
  DEFAULT_AVALON_CONFIG,
  parseConfig,
  parseSettings,
  validateSetup,
  type AvalonConfig,
  type AvalonSettings,
} from '../domain/game-config.js';
import type { AvalonState } from '../domain/state.js';
import { getCurrentPlayerIds } from '../rules/legal-moves.js';
import { getWinners } from '../rules/outcome.rules.js';
import { getPublicView, type AvalonView } from '../visibility/public-view.js';
import { applyAction } from './apply-action.js';
import { createInitialState } from './create-initial-state.js';
import { parseAction } from './parse-action.js';
import { validateAction } from './validate-action.js';

export class AvalonEngine implements GameEngine<
  AvalonState,
  AvalonAction,
  AvalonConfig,
  AvalonSettings
> {
  readonly gameType = AVALON_GAME_TYPE;
  readonly engineVersion = AVALON_ENGINE_VERSION;

  readonly defaultConfig = DEFAULT_AVALON_CONFIG;

  parseConfig(raw: unknown): ParseConfigResult<AvalonConfig> {
    return parseConfig(raw);
  }

  parseSettings(raw: unknown, config: AvalonConfig): ParseSettingsResult<AvalonSettings> {
    return parseSettings(raw, config);
  }

  /** The roles a host chose take seats on their side: they have to fit the table. */
  validateSetup(input: ValidateSetupInput<AvalonConfig, AvalonSettings>): GameValidationResult {
    return validateSetup(input.playerCount, input.settings, input.config);
  }

  createInitialState(input: CreateInitialStateInput<AvalonConfig, AvalonSettings>): AvalonState {
    return createInitialState(input);
  }

  parseAction(raw: unknown): ParseActionResult<AvalonAction> {
    return parseAction(raw);
  }

  validateAction(
    state: AvalonState,
    action: AvalonAction,
    context: GameActionContext,
  ): GameValidationResult {
    return validateAction(state, action, context);
  }

  applyAction(state: AvalonState, action: AvalonAction, context: GameActionContext): AvalonState {
    return applyAction(state, action, context);
  }

  getGameStatus(state: AvalonState): GameStatus {
    return state.phase === 'FINISHED' ? 'finished' : 'playing';
  }

  /** Several players at once while a team is voted on or a quest is played. */
  getCurrentPlayerIds(state: AvalonState): string[] {
    return getCurrentPlayerIds(state);
  }

  /** A side wins together: every player on it is a winner. There are no scores. */
  getResult(state: AvalonState): GameResult | null {
    if (state.phase !== 'FINISHED') return null;
    return { winnerPlayerIds: getWinners(state) };
  }

  getPublicView(state: AvalonState, viewer: GameViewer): AvalonView {
    return getPublicView(state, viewer);
  }
}
