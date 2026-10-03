import type { GameValidationResult } from '@bgp/game-core';
import { hasCube, isOnBoard, stackAt, type PlayerBoard } from '../domain/board.js';
import { HarmoniesRuleCodes } from '../domain/errors.js';
import type { HarmoniesConfig } from '../domain/game-config.js';
import type { Hex } from '../domain/hex.js';
import type { TokenColor } from '../domain/tokens.js';

const MAX_MOUNTAIN_HEIGHT = 3;
const MAX_TRUNKS = 2;

/**
 * Stacking rules:
 * - anything may start a stack on an empty cell;
 * - water and fields stay flat: nothing goes on them and they go on nothing;
 * - mountains stack on mountains, up to 3 high;
 * - trunks stack on trunks, up to 2; a leaf tops 1 or 2 trunks and closes the tree;
 * - a building goes on a single mountain, trunk or building token (2 high).
 */
export function canStack(stack: readonly TokenColor[], color: TokenColor): boolean {
  if (stack.length === 0) return true;
  const top = stack.at(-1);

  switch (color) {
    case 'water':
    case 'field':
      return false;
    case 'mountain':
      return top === 'mountain' && stack.length < MAX_MOUNTAIN_HEIGHT;
    case 'trunk':
      return top === 'trunk' && stack.length < MAX_TRUNKS;
    case 'leaf':
      return top === 'trunk';
    case 'building':
      return stack.length === 1 && (top === 'mountain' || top === 'trunk' || top === 'building');
  }
}

type BoardShape = Pick<HarmoniesConfig, 'boardCells'>;

export function validateTokenPlacement(
  config: BoardShape,
  board: PlayerBoard,
  color: TokenColor,
  cell: Hex,
): GameValidationResult {
  if (!isOnBoard(config.boardCells, cell)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.InvalidPosition,
      message: 'That cell is not on your board.',
    };
  }
  if (hasCube(board, cell)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.CellHasCube,
      message: 'You cannot build on a cell that holds an animal.',
    };
  }
  if (!canStack(stackAt(board, cell), color)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.IllegalStack,
      message: `A ${color} token cannot be placed there.`,
    };
  }
  return { valid: true };
}

export function getLegalTokenCells(
  config: BoardShape,
  board: PlayerBoard,
  color: TokenColor,
): Hex[] {
  return config.boardCells.filter(
    (cell) => validateTokenPlacement(config, board, color, cell).valid,
  );
}
