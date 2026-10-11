import { monitorEventLoopDelay } from 'node:perf_hooks';
import { createSeededRandom } from '@bgp/game-core';
import { HarmoniesGame } from '@bgp/game-harmonies';
import { afterEach, describe, expect, it } from 'vitest';
import { GameRegistry } from '../games/game-registry.js';
import { registeredGames } from '../games/registered-games.js';
import { BotThinker } from './bot-thinker.js';

describe('where the bots think', () => {
  const registry = new GameRegistry();
  for (const game of registeredGames) registry.register(game);
  let thinker: BotThinker;

  afterEach(() => thinker?.onApplicationShutdown());

  const { engine, bot } = HarmoniesGame;

  function newMatch() {
    const config = engine.defaultConfig;
    const settings = engine.parseSettings(undefined, config);
    if (!settings.ok) throw new Error(settings.message);
    return engine.createInitialState({
      gameId: 'thinker',
      players: [
        { playerId: 'p1', seat: 0 },
        { playerId: 'p2', seat: 1 },
      ],
      seed: 'thinker',
      config,
      settings: settings.settings,
    });
  }

  type State = ReturnType<typeof newMatch>;

  function question(state: State, level: 'easy' | 'normal' | 'hard', turn = 0) {
    const playerId = engine.getCurrentPlayerIds(state)[0]!;
    return {
      gameType: 'harmonies',
      view: engine.getPublicView(state, { type: 'player', playerId }),
      playerId,
      level,
      seed: `thinker:${turn}:${level}`,
    };
  }

  const harmoniesQuestion = (level: 'easy' | 'hard') => question(newMatch(), level);

  function chooseHere(asked: ReturnType<typeof question>) {
    const started = performance.now();
    const action = bot!.chooseAction({
      view: asked.view,
      playerId: asked.playerId,
      level: asked.level,
      random: createSeededRandom(asked.seed),
    });
    return { action, ms: performance.now() - started };
  }

  /** The position, some way into a match, that a hard bot takes longest over. */
  function hardestQuestion() {
    let state = newMatch();
    let hardest = { asked: question(state, 'hard'), ms: 0 };
    for (let turn = 0; turn < 40; turn++) {
      const asked = question(state, 'hard', turn);
      const { ms } = chooseHere(asked);
      if (ms > hardest.ms) hardest = { asked, ms };
      const move = question(state, 'normal', turn);
      state = engine.applyAction(state, chooseHere(move).action, {
        actorPlayerId: move.playerId,
        requestId: String(turn),
        now: new Date(0).toISOString(),
      });
    }
    return hardest;
  }

  it('answers from another thread exactly as the strategy would here', async () => {
    thinker = new BotThinker(registry);
    const { asked } = hardestQuestion();
    expect(await thinker.choose(asked)).toEqual(chooseHere(asked).action);
  }, 20_000);

  it('leaves this thread free while a hard bot searches', async () => {
    thinker = new BotThinker(registry);
    const { asked, ms: searchMs } = hardestQuestion();
    // The first question pays for starting the thread; measure the ones after it.
    await thinker.choose(harmoniesQuestion('easy'));
    const delay = monitorEventLoopDelay({ resolution: 2 });
    delay.enable();
    await Promise.all(Array.from({ length: 5 }, () => thinker.choose(asked)));
    delay.disable();
    // Searched here, each of the five would have stopped this thread for `searchMs`.
    expect(delay.max / 1e6).toBeLessThan(searchMs / 2);
  }, 20_000);

  it('passes on a strategy that fails as a failure, and goes on answering', async () => {
    thinker = new BotThinker(registry);
    await expect(
      thinker.choose({ ...harmoniesQuestion('easy'), gameType: 'no-such-game' }),
    ).rejects.toThrow(/No bot/);
    expect(await thinker.choose(harmoniesQuestion('easy'))).toBeDefined();
  }, 20_000);
});
