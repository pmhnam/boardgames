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
  countIslands,
  scoreIslands,
  scoreRiver,
  scoreWater,
} from '../src/scoring/score.js';
import { boardWith, cards, config } from './fixtures/states.js';

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

describe('water: longest river', () => {
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
    expect(scoreRiver(board)).toBe(8);
  });

  it('measures a lake by its two furthest cells, not its size', () => {
    // A triangle of three: any two cells touch, so the river is 2 long.
    const board = boardWith({ '0,0': ['water'], '1,0': ['water'], '0,1': ['water'] });
    expect(scoreRiver(board)).toBe(2);
  });
});

describe('water: islands', () => {
  const cells = config.boardCells;
  const water = (...keys: string[]) =>
    boardWith(Object.fromEntries(keys.map((key) => [key, ['water']])));

  it('counts a board with no water as a single island', () => {
    expect(countIslands(cells, boardWith({}))).toBe(1);
    expect(scoreIslands(cells, boardWith({ '0,0': ['field'], '2,1': ['mountain'] }))).toBe(5);
  });

  it('does not split the land with water that leaves a way round', () => {
    expect(countIslands(cells, water('2,0', '2,1'))).toBe(1);
  });

  it('counts each area cut off by water, built on or empty', () => {
    // Column q=1 is all water: columns 0 and 2-4 are separated.
    const split = water('1,0', '1,1', '1,2', '1,3');
    expect(countIslands(cells, split)).toBe(2);
    expect(scoreIslands(cells, split)).toBe(10);

    // Column q=3 as well: three islands.
    expect(
      countIslands(cells, water('1,0', '1,1', '1,2', '1,3', '3,-1', '3,0', '3,1', '3,2')),
    ).toBe(3);
  });

  it('counts a single cut-off cell as an island', () => {
    // The corner (0,0) touches only (0,1) and (1,0).
    expect(countIslands(cells, water('0,1', '1,0'))).toBe(2);
  });

  it('treats tokens on land as part of the island, whatever they are', () => {
    const board = boardWith({
      '1,0': ['water'],
      '1,1': ['water'],
      '1,2': ['water'],
      '1,3': ['water'],
      '0,0': ['trunk', 'leaf'],
      '4,0': ['mountain', 'building'],
    });
    expect(countIslands(cells, board)).toBe(2);
  });
});

describe('water: chosen by config', () => {
  const board = boardWith({ '0,0': ['water'], '0,1': ['water'], '0,2': ['water'] });

  it('scores islands or the river depending on the setting', () => {
    expect(scoreWater({ ...config, waterScoring: 'islands' }, board)).toBe(5);
    expect(scoreWater({ ...config, waterScoring: 'river' }, board)).toBe(5);
    const longer = boardWith({ ...board.stacks, '0,3': ['water'] });
    expect(scoreWater({ ...config, waterScoring: 'islands' }, longer)).toBe(5);
    expect(scoreWater({ ...config, waterScoring: 'river' }, longer)).toBe(8);
  });
});

describe('animals', () => {
  it('scores each card by the cubes placed from it', () => {
    const board = boardWith(
      {},
      {
        cards: [
          { cardId: 'animal-05', cubesPlaced: 0 },
          { cardId: 'animal-04', cubesPlaced: 2 },
          { cardId: 'animal-01', cubesPlaced: 3 },
        ],
      },
    );
    expect(scoreAnimals(cards, board)).toBe(0 + 10 + 15);
  });
});

describe('calculateBoardScore', () => {
  it('sums every category', () => {
    const board = boardWith(
      { '0,0': ['leaf'], '4,0': ['field'], '4,1': ['field'], '2,0': ['water'], '2,1': ['water'] },
      { cards: [{ cardId: 'animal-05', cubesPlaced: 1 }] },
    );
    expect(calculateBoardScore(config, board)).toEqual({
      trees: 1,
      mountains: 0,
      fields: 5,
      buildings: 0,
      water: 5,
      animals: 2,
      total: 13,
    });
  });
});
