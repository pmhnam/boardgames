import { createSeededRandom } from '@bgp/game-core';
import { deepFreeze, seats, type ScriptedAction } from '@bgp/game-core/testing';
import type { CatanAction } from '../../src/domain/actions.js';
import type { CatanConfig, CatanSettings } from '../../src/domain/game-config.js';
import { RESOURCES } from '../../src/domain/resources.js';
import type { CatanState } from '../../src/domain/state.js';
import { listLegalActions } from '../../src/rules/legal-moves.js';
import type { CatanView } from '../../src/visibility/public-view.js';
import { context, engine } from './states.js';

const WORTH_POINTS = ['BUILD_CITY', 'BUILD_SETTLEMENT', 'BUY_DEVELOPMENT_CARD'];
/** How often a scripted player offers the table a trade instead of anything else. */
const OFFER_CHANCE = 0.05;
/** How often it trades with the supply when it could also do something else. */
const SUPPLY_TRADE_CHANCE = 0.1;
const MAX_ACTIONS = 30_000;

/** What a seat can do, spelled out from nothing but its own view. */
export function listOptions(view: CatanView, playerId: string): CatanAction[] {
  const seat = view.players[playerId];
  if (!seat?.resources) throw new Error(`No hand in the view of ${playerId}`);
  return listLegalActions(view.legal, {
    step: view.turn.step,
    resources: seat.resources,
    supplyRates: seat.supplyRates,
    supply: view.supply,
  });
}

/**
 * Writes a whole game by picking legal moves at random from each player's own view, taking
 * whatever is worth points when it can so the game moves towards its end. Now and then a
 * player offers a one-for-one trade, so the out-of-turn answers are played too.
 */
export function scriptFullGame(
  seed: string,
  playerCount: number,
  config: CatanConfig = engine.defaultConfig,
  settings?: CatanSettings,
  onState?: (state: CatanState) => void,
): ScriptedAction<CatanAction>[] {
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

  const script: ScriptedAction<CatanAction>[] = [];
  while (engine.getGameStatus(state) === 'playing') {
    if (script.length > MAX_ACTIONS) throw new Error('Scripted game did not end');
    onState?.(state);
    const playerId = engine.getCurrentPlayerIds(state)[0];
    if (playerId === undefined) throw new Error('Nobody to move');
    const view = engine.getPublicView(state, { type: 'player', playerId });
    const options = listOptions(view, playerId);
    if (options.length === 0) throw new Error(`No legal action for ${playerId}`);

    const held = RESOURCES.filter(
      (resource) => (view.players[playerId]?.resources?.[resource] ?? 0) > 0,
    );
    const scoring = options.filter((option) => WORTH_POINTS.includes(option.type));
    const calm = options.filter((option) => option.type !== 'SUPPLY_TRADE');
    let action: CatanAction;
    if (scoring.length > 0) {
      action = random.pick(scoring);
    } else if (view.legal.canTrade && held.length > 0 && random.next() < OFFER_CHANCE) {
      const give = random.pick(held);
      const receive = random.pick(RESOURCES.filter((resource) => resource !== give));
      action = { type: 'PROPOSE_TRADE', give: { [give]: 1 }, receive: { [receive]: 1 } };
    } else {
      action = random.pick(
        calm.length === 0 || random.next() < SUPPLY_TRADE_CHANCE ? options : calm,
      );
    }

    script.push({ playerId, action });
    state = deepFreeze(engine.applyAction(state, action, context(playerId)));
  }
  onState?.(state);
  return script;
}
