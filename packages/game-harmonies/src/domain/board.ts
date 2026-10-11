import { hexKey, type Hex } from './hex.js';
import type { TokenColor } from './tokens.js';

/** Bottom to top. */
export type Stack = TokenColor[];

export interface PlayerCard {
  cardId: string;
  cubesPlaced: number;
}

export interface PlayerBoard {
  /** Keyed by hexKey. A missing key is an empty cell. */
  stacks: Record<string, Stack>;
  /** hexKeys of cells holding an animal cube. */
  cubes: string[];
  /** In the order they were taken. Completed cards stay here. */
  cards: PlayerCard[];
}

/**
 * A board made of columns that alternate tall, short, tall..., the short ones one cell shorter
 * and sitting half a cell lower.
 */
export function columnBoard(columnCount: number, tallColumnHeight: number): Hex[] {
  return Array.from({ length: columnCount }, (_, q) => {
    const height = q % 2 === 0 ? tallColumnHeight : tallColumnHeight - 1;
    const firstR = -Math.floor(q / 2);
    return Array.from({ length: height }, (_, row) => ({ q, r: firstR + row }));
  }).flat();
}

/** Side A of the printed board: columns of 5, 4, 5, 4, 5 cells (23). */
export const SIDE_A_CELLS: readonly Hex[] = columnBoard(5, 5);

/** Side B of the printed board: columns of 4, 3, 4, 3, 4, 3, 4 cells (25). */
export const SIDE_B_CELLS: readonly Hex[] = columnBoard(7, 4);

export function isOnBoard(cells: readonly Hex[], hex: Hex): boolean {
  return cells.some((cell) => cell.q === hex.q && cell.r === hex.r);
}

export function createEmptyBoard(): PlayerBoard {
  return { stacks: {}, cubes: [], cards: [] };
}

/** What every empty cell holds: one stack that is never added to, in place of a new one each time. */
export const NO_STACK = Object.freeze([]) as unknown as Stack;

export function stackAt(board: Pick<PlayerBoard, 'stacks'>, hex: Hex): Stack {
  return board.stacks[hexKey(hex)] ?? NO_STACK;
}

export function hasCube(board: Pick<PlayerBoard, 'cubes'>, hex: Hex): boolean {
  return board.cubes.includes(hexKey(hex));
}

export function countEmptyCells(cells: readonly Hex[], board: Pick<PlayerBoard, 'stacks'>): number {
  return cells.filter((cell) => stackAt(board, cell).length === 0).length;
}

export const TERRAIN_KINDS = ['water', 'field', 'mountain', 'tree', 'building'] as const;

export type TerrainKind = (typeof TERRAIN_KINDS)[number];

export interface Terrain {
  kind: TerrainKind;
  height: number;
}

/**
 * `classifyStack(stack)?.kind`, without making the terrain: asked of every stack on a board
 * each time that board is scored.
 */
export function terrainKindOf(stack: readonly TokenColor[]): TerrainKind | null {
  switch (stack.at(-1)) {
    case 'water':
      return 'water';
    case 'field':
      return 'field';
    case 'mountain':
      return 'mountain';
    case 'leaf':
      return 'tree';
    case 'building':
      return stack.length === 2 ? 'building' : null;
    default:
      return null;
  }
}

/** Whether a stack is exactly this terrain at this height, without making the terrain. */
export function isTerrain(
  stack: readonly TokenColor[],
  kind: TerrainKind,
  height: number,
): boolean {
  if (terrainKindOf(stack) !== kind) return false;
  switch (kind) {
    case 'water':
    case 'field':
      return height === 1;
    case 'building':
      return height === 2;
    default:
      return height === stack.length;
  }
}

/**
 * What a stack counts as for scoring and habitats. Unfinished stacks (a bare trunk, a lone
 * building token) are not a terrain yet.
 */
export function classifyStack(stack: readonly TokenColor[]): Terrain | null {
  const top = stack.at(-1);
  switch (top) {
    case 'water':
      return { kind: 'water', height: 1 };
    case 'field':
      return { kind: 'field', height: 1 };
    case 'mountain':
      return { kind: 'mountain', height: stack.length };
    case 'leaf':
      return { kind: 'tree', height: stack.length };
    case 'building':
      return stack.length === 2 ? { kind: 'building', height: 2 } : null;
    default:
      return null;
  }
}
