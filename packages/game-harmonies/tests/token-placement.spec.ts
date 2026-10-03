import { describe, expect, it } from 'vitest';
import { SIDE_A_CELLS, SIDE_B_CELLS } from '../src/domain/board.js';
import type { TokenColor } from '../src/domain/tokens.js';
import { HarmoniesRuleCodes } from '../src/index.js';
import { canStack, validateTokenPlacement } from '../src/rules/token-placement.rules.js';
import { boardWith, config, setupB } from './fixtures/states.js';

describe('boards', () => {
  const columnSizes = (cells: readonly { q: number }[], columns: number) =>
    Array.from({ length: columns }, (_, q) => cells.filter((cell) => cell.q === q).length);

  it('side A has 23 cells in columns of 5, 4, 5, 4, 5', () => {
    expect(SIDE_A_CELLS).toHaveLength(23);
    expect(columnSizes(SIDE_A_CELLS, 5)).toEqual([5, 4, 5, 4, 5]);
  });

  it('side B has 25 cells in columns of 4, 3, 4, 3, 4, 3, 4', () => {
    expect(SIDE_B_CELLS).toHaveLength(25);
    expect(columnSizes(SIDE_B_CELLS, 7)).toEqual([4, 3, 4, 3, 4, 3, 4]);
  });

  it('places tokens only on the cells of the map in play', () => {
    // (6,-3) is the top of side B's last column; side A stops at column 4.
    const cell = { q: 6, r: -3 };
    expect(validateTokenPlacement(setupB, boardWith({}), 'water', cell)).toEqual({ valid: true });
    expect(validateTokenPlacement(config, boardWith({}), 'water', cell)).toMatchObject({
      code: HarmoniesRuleCodes.InvalidPosition,
    });
  });
});

describe('canStack', () => {
  const cases: Array<[TokenColor[], TokenColor, boolean]> = [
    // Anything starts a stack.
    [[], 'water', true],
    [[], 'field', true],
    [[], 'leaf', true],
    [[], 'building', true],
    // Water and fields stay flat.
    [['water'], 'water', false],
    [['field'], 'field', false],
    [['mountain'], 'water', false],
    [['water'], 'mountain', false],
    [['field'], 'building', false],
    // Mountains: up to three, only on mountains.
    [['mountain'], 'mountain', true],
    [['mountain', 'mountain'], 'mountain', true],
    [['mountain', 'mountain', 'mountain'], 'mountain', false],
    [['trunk'], 'mountain', false],
    // Trees: up to two trunks, closed by a leaf.
    [['trunk'], 'trunk', true],
    [['trunk', 'trunk'], 'trunk', false],
    [['trunk'], 'leaf', true],
    [['trunk', 'trunk'], 'leaf', true],
    [['leaf'], 'leaf', false],
    [['trunk', 'leaf'], 'trunk', false],
    [['mountain'], 'leaf', false],
    // Buildings: on one mountain, trunk or building token.
    [['mountain'], 'building', true],
    [['trunk'], 'building', true],
    [['building'], 'building', true],
    [['mountain', 'mountain'], 'building', false],
    [['building', 'building'], 'building', false],
    [['leaf'], 'building', false],
    [['water'], 'building', false],
  ];

  it.each(cases)('%j + %s -> %s', (stack, color, expected) => {
    expect(canStack(stack, color)).toBe(expected);
  });
});

describe('validateTokenPlacement', () => {
  it('rejects cells that are not on the board', () => {
    expect(validateTokenPlacement(config, boardWith({}), 'water', { q: 1, r: 4 })).toMatchObject({
      code: HarmoniesRuleCodes.InvalidPosition,
    });
    expect(validateTokenPlacement(config, boardWith({}), 'water', { q: 9, r: 9 })).toMatchObject({
      code: HarmoniesRuleCodes.InvalidPosition,
    });
  });

  it('rejects a cell that holds an animal', () => {
    const board = boardWith({ '0,0': ['mountain'] }, { cubes: ['0,0'] });
    expect(validateTokenPlacement(config, board, 'mountain', { q: 0, r: 0 })).toMatchObject({
      code: HarmoniesRuleCodes.CellHasCube,
    });
  });

  it('rejects an illegal stack and accepts a legal one', () => {
    const board = boardWith({ '0,0': ['water'], '0,1': ['trunk'] });
    expect(validateTokenPlacement(config, board, 'leaf', { q: 0, r: 0 })).toMatchObject({
      code: HarmoniesRuleCodes.IllegalStack,
    });
    expect(validateTokenPlacement(config, board, 'leaf', { q: 0, r: 1 })).toEqual({ valid: true });
  });
});
