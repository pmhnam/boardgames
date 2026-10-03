import { describe, expect, it } from 'vitest';
import type { Stack } from '../src/domain/board.js';
import {
  calculateBoardScore,
  riverPoints,
  scoreAnimals,
  scoreBuildings,
  scoreFields,
  scoreMountains,
  scoreTrees,
  scoreWater,
} from '../src/scoring/score.js';
import { boardWith, cards } from './fixtures/states.js';

describe('trees', () => {
  it('scores 1, 3 and 7 by height and ignores bare trunks', () => {
    const board = boardWith({
      '0,0': ['leaf'],
      '0,2': ['trunk', 'leaf'],
      '0,4': ['trunk', 'trunk', 'leaf'],
      '2,0': ['trunk'],
      '2,2': ['trunk', 'trunk'],
    });
    expect(scoreTrees(board)).toBe(1 + 3 + 7);
  });
});

describe('mountains', () => {
  it('scores nothing for an isolated mountain', () => {
    expect(scoreMountains(boardWith({ '0,0': ['mountain', 'mountain', 'mountain'] }))).toBe(0);
  });

  it('scores adjacent mountains by height', () => {
    const board = boardWith({
      '0,0': ['mountain'],
      '0,1': ['mountain', 'mountain'],
      '1,0': ['mountain', 'mountain', 'mountain'],
      '4,2': ['mountain', 'mountain', 'mountain'],
    });
    expect(scoreMountains(board)).toBe(1 + 3 + 7);
  });

  it('does not count a mountain that became a building', () => {
    const board = boardWith({ '0,0': ['mountain'], '0,1': ['mountain', 'building'] });
    expect(scoreMountains(board)).toBe(0);
  });
});

describe('fields', () => {
  it('scores 5 per group of two or more', () => {
    const board = boardWith({
      // A group of three.
      '0,0': ['field'],
      '0,1': ['field'],
      '1,0': ['field'],
      // A group of two.
      '4,1': ['field'],
      '4,2': ['field'],
      // Alone.
      '2,3': ['field'],
    });
    expect(scoreFields(board)).toBe(10);
  });
});

describe('buildings', () => {
  it('needs three different colours around it', () => {
    const building: Record<string, Stack> = { '2,1': ['mountain', 'building'] };
    const two = boardWith({ ...building, '2,0': ['water'], '2,2': ['field'], '3,0': ['field'] });
    const three = boardWith({ ...building, '2,0': ['water'], '2,2': ['field'], '3,0': ['leaf'] });
    expect(scoreBuildings(two)).toBe(0);
    expect(scoreBuildings(three)).toBe(5);
  });

  it('ignores a lone building token', () => {
    const board = boardWith({
      '2,1': ['building'],
      '2,0': ['water'],
      '2,2': ['field'],
      '3,0': ['leaf'],
    });
    expect(scoreBuildings(board)).toBe(0);
  });
});

describe('water', () => {
  it('follows the river table', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(riverPoints)).toEqual([0, 0, 2, 5, 8, 11, 15, 19, 23]);
  });

  it('scores only the longest river', () => {
    const board = boardWith({
      // Column of four.
      '0,0': ['water'],
      '0,1': ['water'],
      '0,2': ['water'],
      '0,3': ['water'],
      // Separate pair.
      '4,0': ['water'],
      '4,1': ['water'],
    });
    expect(scoreWater(board)).toBe(8);
  });

  it('measures a lake by its two furthest cells, not its size', () => {
    // A triangle of three: any two cells touch, so the river is 2 long.
    const board = boardWith({ '0,0': ['water'], '1,0': ['water'], '0,1': ['water'] });
    expect(scoreWater(board)).toBe(2);
  });
});

describe('animals', () => {
  it('scores each card by the cubes placed from it', () => {
    const board = boardWith(
      {},
      {
        cards: [
          { cardId: 'heron', cubesPlaced: 0 },
          { cardId: 'frog', cubesPlaced: 2 },
          { cardId: 'otter', cubesPlaced: 3 },
        ],
      },
    );
    expect(scoreAnimals(cards, board)).toBe(0 + 5 + 15);
  });
});

describe('calculateBoardScore', () => {
  it('sums every category', () => {
    const board = boardWith(
      { '0,0': ['leaf'], '4,0': ['field'], '4,1': ['field'], '2,0': ['water'], '2,1': ['water'] },
      { cards: [{ cardId: 'heron', cubesPlaced: 1 }] },
    );
    expect(calculateBoardScore(cards, board)).toEqual({
      trees: 1,
      mountains: 0,
      fields: 5,
      buildings: 0,
      water: 2,
      animals: 2,
      total: 10,
    });
  });
});
