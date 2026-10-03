import { BOT_LEVELS, createSeededRandom, type BotLevel } from '@bgp/game-core';
import { playBotMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import { GridClaimBot, GridClaimGame } from '../src/index.js';

const engine = GridClaimGame.engine;
const seeds = Array.from({ length: 30 }, (_, index) => `seed-${index}`);

/** How often `level` wins against `opponent`, playing each seed from both seats. */
function winRate(level: BotLevel, opponent: BotLevel): number {
  let wins = 0;
  let games = 0;
  for (const seed of seeds) {
    for (const levels of [
      [level, opponent],
      [opponent, level],
    ] as BotLevel[][]) {
      const { state } = playBotMatch(engine, GridClaimBot, { seed, levels });
      const me = levels[0] === level ? 'p1' : 'p2';
      games += 1;
      if (state.winnerPlayerIds.length === 1 && state.winnerPlayerIds[0] === me) wins += 1;
    }
  }
  return wins / games;
}

describe('Grid Claim bot', () => {
  it.each(BOT_LEVELS)('%s only plays legal moves and always finishes the game', (level) => {
    for (const seed of seeds.slice(0, 10)) {
      const { state, actionCount } = playBotMatch(engine, GridClaimBot, {
        seed,
        levels: [level, level],
      });
      expect(engine.getGameStatus(state)).toBe('finished');
      expect(actionCount).toBeGreaterThan(0);
    }
  });

  it('is deterministic for the same view and random seed', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 'det',
      config: engine.defaultConfig,
      settings: {},
    });
    const playerId = state.turn.activePlayerId;
    const view = engine.getPublicView(state, { type: 'player', playerId });
    for (const level of BOT_LEVELS) {
      const choose = () =>
        GridClaimBot.chooseAction({ view, playerId, level, random: createSeededRandom('r') });
      expect(choose()).toEqual(choose());
    }
  });

  it('takes a winning move when it has one', () => {
    const base = engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 'win',
      config: { boardSize: 5, blockedCellCount: 0, targetScore: 10 },
      settings: {},
    });
    // p1 holds a 2x2 square (8 points); any cell beside it reaches 10.
    const cells = [...base.cells];
    for (const index of [0, 1, 5, 6]) cells[index] = 'p1';
    const state = { ...base, cells, turn: { number: 9, activePlayerId: 'p1' } };
    const view = engine.getPublicView(state, { type: 'player', playerId: 'p1' });

    for (const level of ['normal', 'hard'] as const) {
      const action = GridClaimBot.chooseAction({
        view,
        playerId: 'p1',
        level,
        random: createSeededRandom('r'),
      });
      const after = engine.applyAction(state, action, {
        actorPlayerId: 'p1',
        requestId: 'r',
        now: '2000-01-01T00:00:00.000Z',
      });
      expect(after.winnerPlayerIds).toEqual(['p1']);
    }
  });

  it('gets stronger with each level', () => {
    expect(winRate('normal', 'easy')).toBeGreaterThan(0.75);
    expect(winRate('hard', 'easy')).toBeGreaterThan(0.75);
    expect(winRate('hard', 'normal')).toBeGreaterThan(0.5);
  });
});
