import { BOT_LEVELS, createSeededRandom, type BotLevel } from '@bgp/game-core';
import { playBotMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import { emptyCellValue, estimateTurnsLeft } from '../src/bot/evaluate.js';
import { HarmoniesBot, type HarmoniesSettings } from '../src/index.js';
import { calculateScores } from '../src/scoring/score.js';
import { MAP_A, MAP_B, engine, gameConfig } from './fixtures/states.js';

function play(seed: string, levels: BotLevel[], settings: HarmoniesSettings = MAP_A) {
  const { state, actionCount } = playBotMatch(engine, HarmoniesBot, { seed, levels, settings });
  const scores = calculateScores(state);
  return {
    state,
    actionCount,
    totals: levels.map((_, seat) => scores[`p${seat + 1}`]?.total ?? 0),
  };
}

/** Average score of each level over a set of seeds, each played from both seats. */
function averageScores(a: BotLevel, b: BotLevel, seeds: string[], settings = MAP_A) {
  const sum = { [a]: 0, [b]: 0 } as Record<BotLevel, number>;
  let games = 0;
  for (const seed of seeds) {
    for (const levels of [
      [a, b],
      [b, a],
    ]) {
      const { totals } = play(seed, levels, settings);
      levels.forEach((level, seat) => (sum[level] += totals[seat] ?? 0));
      games += 1;
    }
  }
  return { [a]: sum[a] / games, [b]: sum[b] / games } as Record<BotLevel, number>;
}

describe('Harmonies bot', () => {
  // playBotMatch throws on any illegal action, so finishing is the assertion.
  it.each([
    ['easy', MAP_A, 2],
    ['easy', MAP_B, 4],
    ['normal', MAP_A, 2],
    ['normal', MAP_B, 3],
    ['hard', MAP_A, 2],
    ['hard', MAP_B, 2],
  ] as Array<[BotLevel, HarmoniesSettings, number]>)(
    '%s only plays legal actions and finishes the game (%j, %i players)',
    (level, settings, players) => {
      const { state, actionCount } = play('legal', Array<BotLevel>(players).fill(level), settings);
      expect(engine.getGameStatus(state)).toBe('finished');
      expect(state.winnerPlayerIds.length).toBeGreaterThan(0);
      expect(actionCount).toBeGreaterThan(players * 4);
    },
    60_000,
  );

  it('is deterministic for the same view and random seed', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 'det',
      config: gameConfig,
      settings: MAP_A,
    });
    const playerId = state.turn.activePlayerId;
    const view = engine.getPublicView(state, { type: 'player', playerId });
    for (const level of BOT_LEVELS) {
      const choose = () =>
        HarmoniesBot.chooseAction({ view, playerId, level, random: createSeededRandom('r') });
      expect(choose()).toEqual(choose());
    }
  });

  it('decides from the player view alone, which hides the draw piles', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 'view',
      config: gameConfig,
      settings: MAP_A,
    });
    const playerId = state.turn.activePlayerId;
    const view = engine.getPublicView(state, { type: 'player', playerId });
    expect(view).not.toHaveProperty('pouch');
    expect(view).not.toHaveProperty('cardDeck');
    // Reordering the hidden pouch changes nothing the bot can see, so nothing it does.
    const shuffled = engine.getPublicView(
      { ...state, pouch: [...state.pouch].reverse() },
      { type: 'player', playerId },
    );
    const choose = (seen: typeof view) =>
      HarmoniesBot.chooseAction({
        view: seen,
        playerId,
        level: 'hard',
        random: createSeededRandom('r'),
      });
    expect(choose(shuffled)).toEqual(choose(view));
  });

  it('places an animal as soon as a habitat is ready', () => {
    const base = engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 'cube',
      config: gameConfig,
      settings: MAP_A,
    });
    const playerId = base.turn.activePlayerId;
    // animal-05: an animal on water next to a height-1 tree.
    const state = {
      ...base,
      boards: {
        ...base.boards,
        [playerId]: {
          stacks: { '2,1': ['water' as const], '3,1': ['leaf' as const] },
          cubes: [],
          cards: [{ cardId: 'animal-05', cubesPlaced: 0 }],
        },
      },
    };
    const view = engine.getPublicView(state, { type: 'player', playerId });
    for (const level of ['normal', 'hard'] as const) {
      expect(
        HarmoniesBot.chooseAction({ view, playerId, level, random: createSeededRandom('r') }),
      ).toEqual({ type: 'PLACE_CUBE', cardId: 'animal-05', cell: { q: 2, r: 1 } });
    }
  });

  it('normal plays far better than easy', () => {
    const scores = averageScores('easy', 'normal', ['s1', 's2', 's3']);
    expect(scores.normal).toBeGreaterThan(scores.easy * 2);
  }, 60_000);

  it('hard outscores normal on both maps', () => {
    const seeds = ['s1', 's2', 's3', 's4'];
    const sideA = averageScores('normal', 'hard', seeds, MAP_A);
    const sideB = averageScores('normal', 'hard', seeds, MAP_B);
    expect(sideA.hard).toBeGreaterThan(sideA.normal);
    expect(sideB.hard).toBeGreaterThan(sideB.normal);
  }, 120_000);
});

describe('how the hard bot values room on its board', () => {
  it('expects the game to end with the pouch or with the fullest opposing board', () => {
    const base = { pouchCount: 90, playerCount: 2, finalRound: false };
    // 90 tokens between two players is 15 turns each.
    expect(estimateTurnsLeft({ ...base, opponentEmptyCells: [23] })).toBeCloseTo(9.5, 1);
    expect(estimateTurnsLeft({ ...base, pouchCount: 12, opponentEmptyCells: [23] })).toBe(2);
    // An opponent four cells from the end is about one turn away from ending the game.
    expect(estimateTurnsLeft({ ...base, opponentEmptyCells: [20, 4] })).toBeLessThan(1);
    expect(estimateTurnsLeft({ ...base, opponentEmptyCells: [23], finalRound: true })).toBe(0);
  });

  it('values empty cells only when tokens will outnumber them', () => {
    const value = (emptyCells: number, turnsLeft: number) =>
      emptyCellValue({ emptyCells, turnsLeft, weight: 2.5 });
    // 30 tokens to come for 10 cells: room is scarce.
    expect(value(10, 10)).toBeGreaterThan(0);
    // 6 tokens to come for 10 cells: there is room to spare.
    expect(value(10, 2)).toBe(0);
    expect(value(10, 0)).toBe(0);
    // Capped, however scarce.
    expect(value(1, 30)).toBe(4);
  });
});
