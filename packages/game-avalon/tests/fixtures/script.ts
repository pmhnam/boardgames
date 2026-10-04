import { createSeededRandom, type SeededRandom } from '@bgp/game-core';
import { deepFreeze, seats, type ScriptedAction } from '@bgp/game-core/testing';
import type { AvalonAction } from '../../src/domain/actions.js';
import type { AvalonConfig, AvalonSettings } from '../../src/domain/game-config.js';
import type { AvalonState } from '../../src/domain/state.js';
import type { AvalonView } from '../../src/visibility/public-view.js';
import { context, engine } from './states.js';

/** How the scripted players lean. Random by default; the others steer a game to one ending. */
export interface Policy {
  votes?: 'random' | 'approve' | 'reject';
  /** What the evil side plays on a quest. */
  cards?: 'random' | 'fail' | 'succeed';
}

/** One legal action for a player, chosen from nothing but that player's own view. */
export function chooseAction(view: AvalonView, random: SeededRandom, policy: Policy): AvalonAction {
  const { legal } = view;
  const coin = () => random.int(2) === 0;
  if (legal.propose) {
    const team = random.shuffle(view.seatOrder).slice(0, legal.propose.teamSize);
    return { type: 'PROPOSE_TEAM', team };
  }
  if (legal.vote) {
    const votes = policy.votes ?? 'random';
    const approve = votes === 'random' ? coin() : votes === 'approve';
    return { type: 'VOTE', proposal: legal.vote.proposal, approve };
  }
  if (legal.quest) {
    const cards = policy.cards ?? 'random';
    const fail = legal.quest.canFail && (cards === 'random' ? coin() : cards === 'fail');
    return { type: 'PLAY_QUEST_CARD', quest: legal.quest.quest, success: !fail };
  }
  if (legal.ladyTargets.length > 0) {
    return { type: 'USE_LADY', targetId: random.pick(legal.ladyTargets) };
  }
  if (legal.assassinTargets.length > 0) {
    return { type: 'ASSASSINATE', targetId: random.pick(legal.assassinTargets) };
  }
  throw new Error('A player to move has no legal action');
}

export interface ScriptedGame {
  script: ScriptedAction<AvalonAction>[];
  /** The state before each action, then the final one. */
  states: AvalonState[];
}

/**
 * Writes a whole game. Whoever acts next is picked at random among those who still owe an
 * action, so simultaneous phases are played in every order.
 */
export function scriptFullGame(
  seed: string,
  playerCount: number,
  options: { settings?: AvalonSettings; policy?: Policy; config?: AvalonConfig } = {},
): ScriptedGame {
  const config = options.config ?? engine.defaultConfig;
  const parsed = engine.parseSettings(options.settings, config);
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

  const script: ScriptedAction<AvalonAction>[] = [];
  const states = [state];
  while (engine.getGameStatus(state) === 'playing') {
    if (script.length > 500) throw new Error('Scripted game did not end');
    const playerId = random.pick(engine.getCurrentPlayerIds(state));
    const view = engine.getPublicView(state, { type: 'player', playerId });
    const action = chooseAction(view, random, options.policy ?? {});
    script.push({ playerId, action });
    state = deepFreeze(engine.applyAction(state, action, context(playerId)));
    states.push(state);
  }
  return { script, states };
}
