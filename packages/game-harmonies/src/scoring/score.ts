import { classifyStack, stackAt, type PlayerBoard } from '../domain/board.js';
import { getCard, getCardPoints, type AnimalCard } from '../domain/cards.js';
import type { HarmoniesSetup } from '../domain/game-config.js';
import { hexKey, hexNeighbours, parseHexKey, type Hex } from '../domain/hex.js';
import type { HarmoniesState } from '../domain/state.js';

export interface ScoreBreakdown {
  trees: number;
  mountains: number;
  fields: number;
  buildings: number;
  water: number;
  animals: number;
  total: number;
}

const HEIGHT_POINTS: Readonly<Record<number, number>> = { 1: 1, 2: 3, 3: 7 };
const FIELD_GROUP_POINTS = 5;
const BUILDING_POINTS = 5;
const BUILDING_MIN_NEIGHBOUR_COLORS = 3;
/** Index = river length. Longer rivers add RIVER_EXTRA_POINTS per cell. */
const RIVER_POINTS = [0, 0, 2, 5, 8, 11, 15];
const RIVER_EXTRA_POINTS = 4;
const ISLAND_POINTS = 5;

/** Scoring reads only what has been built, so it needs no knowledge of the board's shape. */
function cellsOfKind(board: PlayerBoard, kind: string): Hex[] {
  return Object.keys(board.stacks)
    .map(parseHexKey)
    .filter((cell) => classifyStack(stackAt(board, cell))?.kind === kind);
}

/** A tree scores by its height: 1, 3 or 7. */
export function scoreTrees(board: PlayerBoard): number {
  return cellsOfKind(board, 'tree').reduce(
    (sum, cell) => sum + (HEIGHT_POINTS[stackAt(board, cell).length] ?? 0),
    0,
  );
}

/** A mountain scores by its height (1, 3 or 7), but only next to another mountain. */
export function scoreMountains(board: PlayerBoard): number {
  const mountains = cellsOfKind(board, 'mountain');
  const keys = new Set(mountains.map(hexKey));
  return mountains
    .filter((cell) => hexNeighbours(cell).some((neighbour) => keys.has(hexKey(neighbour))))
    .reduce((sum, cell) => sum + (HEIGHT_POINTS[stackAt(board, cell).length] ?? 0), 0);
}

function connectedGroups(cells: readonly Hex[]): Hex[][] {
  const remaining = new Map(cells.map((cell) => [hexKey(cell), cell]));
  const groups: Hex[][] = [];
  for (const start of cells) {
    if (!remaining.delete(hexKey(start))) continue;
    const group = [start];
    for (const cell of group) {
      for (const neighbour of hexNeighbours(cell)) {
        const found = remaining.get(hexKey(neighbour));
        if (found && remaining.delete(hexKey(neighbour))) group.push(found);
      }
    }
    groups.push(group);
  }
  return groups;
}

/** Every separate field of two or more cells scores 5. */
export function scoreFields(board: PlayerBoard): number {
  return (
    connectedGroups(cellsOfKind(board, 'field')).filter((group) => group.length >= 2).length *
    FIELD_GROUP_POINTS
  );
}

/** A building scores 5 when the tokens around it show at least three different colours. */
export function scoreBuildings(board: PlayerBoard): number {
  return (
    cellsOfKind(board, 'building').filter((cell) => {
      const colors = new Set(
        hexNeighbours(cell)
          .map((neighbour) => stackAt(board, neighbour).at(-1))
          .filter((color) => color !== undefined),
      );
      return colors.size >= BUILDING_MIN_NEIGHBOUR_COLORS;
    }).length * BUILDING_POINTS
  );
}

/** Length of a river: the two cells furthest apart, counted along the water. */
function riverLength(group: Hex[]): number {
  const keys = new Set(group.map(hexKey));
  let longest = 0;
  for (const start of group) {
    const distance = new Map([[hexKey(start), 1]]);
    const queue = [start];
    for (const cell of queue) {
      const here = distance.get(hexKey(cell)) ?? 1;
      longest = Math.max(longest, here);
      for (const neighbour of hexNeighbours(cell)) {
        const key = hexKey(neighbour);
        if (keys.has(key) && !distance.has(key)) {
          distance.set(key, here + 1);
          queue.push(neighbour);
        }
      }
    }
  }
  return longest;
}

export function riverPoints(length: number): number {
  const lastIndex = RIVER_POINTS.length - 1;
  return length <= lastIndex
    ? (RIVER_POINTS[length] ?? 0)
    : (RIVER_POINTS[lastIndex] ?? 0) + (length - lastIndex) * RIVER_EXTRA_POINTS;
}

/** Only the longest river scores. */
export function scoreRiver(board: PlayerBoard): number {
  const longest = Math.max(0, ...connectedGroups(cellsOfKind(board, 'water')).map(riverLength));
  return riverPoints(longest);
}

/**
 * An island is an area of board cells, built on or empty, that water and the board's edge
 * separate from the rest. A board with no water at all is therefore a single island.
 */
export function countIslands(boardCells: readonly Hex[], board: PlayerBoard): number {
  const land = boardCells.filter((cell) => stackAt(board, cell).at(-1) !== 'water');
  return connectedGroups(land).length;
}

/** Every island scores 5. */
export function scoreIslands(boardCells: readonly Hex[], board: PlayerBoard): number {
  return countIslands(boardCells, board) * ISLAND_POINTS;
}

export function scoreWater(
  config: Pick<HarmoniesSetup, 'boardCells' | 'waterScoring'>,
  board: PlayerBoard,
): number {
  switch (config.waterScoring) {
    case 'islands':
      return scoreIslands(config.boardCells, board);
    case 'river':
      return scoreRiver(board);
  }
}

export function scoreAnimals(cards: readonly AnimalCard[], board: PlayerBoard): number {
  return board.cards.reduce(
    (sum, owned) => sum + getCardPoints(getCard(cards, owned.cardId), owned.cubesPlaced),
    0,
  );
}

export function calculateBoardScore(
  config: Pick<HarmoniesSetup, 'boardCells' | 'waterScoring' | 'cards'>,
  board: PlayerBoard,
): ScoreBreakdown {
  const parts = {
    trees: scoreTrees(board),
    mountains: scoreMountains(board),
    fields: scoreFields(board),
    buildings: scoreBuildings(board),
    water: scoreWater(config, board),
    animals: scoreAnimals(config.cards, board),
  };
  return { ...parts, total: Object.values(parts).reduce((sum, value) => sum + value, 0) };
}

export function calculateScores(
  state: Pick<HarmoniesState, 'boards' | 'turnOrder' | 'config'>,
): Record<string, ScoreBreakdown> {
  return Object.fromEntries(
    state.turnOrder.map((playerId) => {
      const board = state.boards[playerId];
      if (!board) throw new Error(`No board for player ${playerId}`);
      return [playerId, calculateBoardScore(state.config, board)];
    }),
  );
}
