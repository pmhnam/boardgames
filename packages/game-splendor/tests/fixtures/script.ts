import { createSeededRandom } from '@bgp/game-core';
import { deepFreeze, seats, type ScriptedAction } from '@bgp/game-core/testing';
import type { SplendorAction } from '../../src/domain/actions.js';
import type { SplendorConfig, SplendorSettings } from '../../src/domain/game-config.js';
import { listLegalActions } from '../../src/rules/legal-moves.js';
import { context, engine } from './states.js';

/**
 * Writes a whole game by picking legal moves at random from each player's own view, buying
 * whenever possible so the game moves towards its end.
 */
export function scriptFullGame(
  seed: string,
  playerCount: number,
  config: SplendorConfig = engine.defaultConfig,
  settings?: SplendorSettings,
): ScriptedAction<SplendorAction>[] {
  const parsed = engine.parseSettings(settings, config);
  if (!parsed.ok) throw new Error(parsed.message);
  const random = createSeededRandom(`script-${seed}`);
  let state = deepFreeze(
    engine.createInitialState({
      gameId: 'test-game',
      players: seats(playerCount),
      seed,
      config,
      settings: parsed.settings,
    }),
  );

  const script: ScriptedAction<SplendorAction>[] = [];
  while (engine.getGameStatus(state) === 'playing') {
    if (script.length > 5000) throw new Error('Scripted game did not end');
    const playerId = state.turn.activePlayerId;
    const view = engine.getPublicView(state, { type: 'player', playerId });
    const tokens = view.players[playerId]?.tokens;
    if (!tokens) throw new Error('No tokens in view');
    const options = listLegalActions(view.legal, tokens);
    const buys = options.filter((option) => option.type === 'BUY_CARD');
    const action = random.pick(buys.length > 0 ? buys : options);
    script.push({ playerId, action });
    state = deepFreeze(engine.applyAction(state, action, context(playerId)));
  }
  return script;
}
