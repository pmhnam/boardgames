import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_CELLS } from '../src/domain/board.js';
import type { TokenColor } from '../src/domain/tokens.js';
import { HarmoniesRuleCodes } from '../src/index.js';
import { canStack, validateTokenPlacement } from '../src/rules/token-placement.rules.js';
import { boardWith, config } from './fixtures/states.js';

describe('board', () => {
  it('has 23 cells in columns of 5, 4, 5, 4, 5', () => {
    expect(DEFAULT_BOARD_CELLS).toHaveLength(23);
    expect(
      [0, 1, 2, 3, 4].map((q) => DEFAULT_BOARD_CELLS.filter((cell) => cell.q === q).length),
    ).toEqual([5, 4, 5, 4, 5]);
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
