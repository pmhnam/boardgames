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
import type { WerewolfAction } from '../domain/actions.js';
import { WEREWOLF_ENGINE_VERSION, WEREWOLF_GAME_TYPE } from '../domain/config.js';
import {
  DEFAULT_WEREWOLF_CONFIG,
  parseConfig,
  parseSettings,
  resolveRoles,
  type WerewolfConfig,
  type WerewolfSettings,
} from '../domain/game-config.js';
import type { WerewolfState } from '../domain/state.js';
import { getOwingPlayerIds } from '../rules/legal-moves.js';
import { getPublicView, type WerewolfView } from '../visibility/public-view.js';
import { applyAction } from './apply-action.js';
import { createInitialState } from './create-initial-state.js';
import { parseAction } from './parse-action.js';
import { validateAction } from './validate-action.js';

export class WerewolfEngine implements GameEngine<
  WerewolfState,
  WerewolfAction,
  WerewolfConfig,
  WerewolfSettings
> {
  readonly gameType = WEREWOLF_GAME_TYPE;
  readonly engineVersion = WEREWOLF_ENGINE_VERSION;

  readonly defaultConfig = DEFAULT_WEREWOLF_CONFIG;

  parseConfig(raw: unknown): ParseConfigResult<WerewolfConfig> {
    return parseConfig(raw);
  }

  parseSettings(raw: unknown, config: WerewolfConfig): ParseSettingsResult<WerewolfSettings> {
    return parseSettings(raw, config);
  }

  /** A cast of roles has to fit the table it is dealt to. */
  validateSetup(input: ValidateSetupInput<WerewolfConfig, WerewolfSettings>): GameValidationResult {
    const cast = resolveRoles(input.settings, input.playerCount, input.config);
    return cast.ok ? { valid: true } : { valid: false, code: cast.code, message: cast.message };
  }

  createInitialState(
    input: CreateInitialStateInput<WerewolfConfig, WerewolfSettings>,
  ): WerewolfState {
    return createInitialState(input);
  }

  parseAction(raw: unknown): ParseActionResult<WerewolfAction> {
    return parseAction(raw);
  }

  validateAction(
    state: WerewolfState,
    action: WerewolfAction,
    context: GameActionContext,
  ): GameValidationResult {
    return validateAction(state, action, context);
  }

  applyAction(
    state: WerewolfState,
    action: WerewolfAction,
    context: GameActionContext,
  ): WerewolfState {
    return applyAction(state, action, context);
  }

  getGameStatus(state: WerewolfState): GameStatus {
    return state.phase === 'FINISHED' ? 'finished' : 'playing';
  }

  /** Everyone the match is waiting on: at night and in a vote that is many players at once. */
  getCurrentPlayerIds(state: WerewolfState): string[] {
    return getOwingPlayerIds(state);
  }

  getResult(state: WerewolfState): GameResult | null {
    if (state.phase !== 'FINISHED') return null;
    return { winnerPlayerIds: [...state.winnerPlayerIds] };
  }

  getPublicView(state: WerewolfState, viewer: GameViewer): WerewolfView {
    return getPublicView(state, viewer);
  }
}
