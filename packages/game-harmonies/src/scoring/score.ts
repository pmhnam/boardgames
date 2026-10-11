import { terrainKindOf, type PlayerBoard, type TerrainKind } from '../domain/board.js';
import { getCard, getCardPoints, type AnimalCard } from '../domain/cards.js';
import type { HarmoniesSetup } from '../domain/game-config.js';
import { hexKey, neighbourKeys, type Hex } from '../domain/hex.js';
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

/**
 * The scoring table, for anything that explains the rules to players. Kept next to the code
 * that applies it, so an explanation cannot drift from what is actually scored.
 */
export const SCORING_RULES = {
  /** Points for a finished tree, or a mountain beside another mountain, by height. */
  pointsByHeight: HEIGHT_POINTS,
  fieldGroupPoints: FIELD_GROUP_POINTS,
  buildingPoints: BUILDING_POINTS,
  buildingMinNeighbourColors: BUILDING_MIN_NEIGHBOUR_COLORS,
  /** Index = length of the longest river. */
  riverPoints: RIVER_POINTS,
  riverExtraPointsPerCell: RIVER_EXTRA_POINTS,
  islandPoints: ISLAND_POINTS,
} as const;

/**
 * Scoring reads only what has been built, so it needs no knowledge of the board's shape. It
 * works on the keys of the cells: a board is scored thousands of times while a bot thinks.
 */
type KeysByKind = Record<TerrainKind, string[]>;

/** Every finished stack on the board under what it counts as, in one pass over the board. */
function sortByKind(board: PlayerBoard): KeysByKind {
  const sorted: KeysByKind = { water: [], field: [], mountain: [], tree: [], building: [] };
  for (const key of Object.keys(board.stacks)) {
    const kind = terrainKindOf(board.stacks[key] ?? []);
    if (kind !== null) sorted[kind].push(key);
  }
  return sorted;
}

const heightPoints = (board: PlayerBoard, key: string): number =>
  HEIGHT_POINTS[board.stacks[key]?.length ?? 0] ?? 0;

function treePoints(board: PlayerBoard, trees: readonly string[]): number {
  return trees.reduce((sum, key) => sum + heightPoints(board, key), 0);
}

/** A tree scores by its height: 1, 3 or 7. */
export function scoreTrees(board: PlayerBoard): number {
  return treePoints(board, sortByKind(board).tree);
}

function mountainPoints(board: PlayerBoard, mountains: readonly string[]): number {
  const keys = new Set(mountains);
  return mountains
    .filter((key) => neighbourKeys(key).some((neighbour) => keys.has(neighbour)))
    .reduce((sum, key) => sum + heightPoints(board, key), 0);
}

/** A mountain scores by its height (1, 3 or 7), but only next to another mountain. */
export function scoreMountains(board: PlayerBoard): number {
  return mountainPoints(board, sortByKind(board).mountain);
}

function connectedGroups(keys: readonly string[]): string[][] {
  const remaining = new Set(keys);
  const groups: string[][] = [];
  for (const start of keys) {
    if (!remaining.delete(start)) continue;
    const group = [start];
    for (const key of group) {
      for (const neighbour of neighbourKeys(key)) {
        if (remaining.delete(neighbour)) group.push(neighbour);
      }
    }
    groups.push(group);
  }
  return groups;
}

function fieldPoints(fields: readonly string[]): number {
  return connectedGroups(fields).filter((group) => group.length >= 2).length * FIELD_GROUP_POINTS;
}

/** Every separate field of two or more cells scores 5. */
export function scoreFields(board: PlayerBoard): number {
  return fieldPoints(sortByKind(board).field);
}

function buildingPoints(board: PlayerBoard, buildings: readonly string[]): number {
  return (
    buildings.filter((key) => {
      const colors = new Set(
        neighbourKeys(key)
          .map((neighbour) => board.stacks[neighbour]?.at(-1))
          .filter((color) => color !== undefined),
      );
      return colors.size >= BUILDING_MIN_NEIGHBOUR_COLORS;
    }).length * BUILDING_POINTS
  );
}

/** A building scores 5 when the tokens around it show at least three different colours. */
export function scoreBuildings(board: PlayerBoard): number {
  return buildingPoints(board, sortByKind(board).building);
}

/** Length of a river: the two cells furthest apart, counted along the water. */
function riverLength(group: readonly string[]): number {
  const keys = new Set(group);
  let longest = 0;
  for (const start of group) {
    const distance = new Map([[start, 1]]);
    const queue = [start];
    for (const key of queue) {
      const here = distance.get(key) ?? 1;
      longest = Math.max(longest, here);
      for (const neighbour of neighbourKeys(key)) {
        if (keys.has(neighbour) && !distance.has(neighbour)) {
          distance.set(neighbour, here + 1);
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

function longestRiverPoints(water: readonly string[]): number {
  return riverPoints(Math.max(0, ...connectedGroups(water).map(riverLength)));
}

/** Only the longest river scores. */
export function scoreRiver(board: PlayerBoard): number {
  return longestRiverPoints(sortByKind(board).water);
}

/**
 * An island is an area of board cells, built on or empty, that water and the board's edge
 * separate from the rest. A board with no water at all is therefore a single island.
 */
export function countIslands(boardCells: readonly Hex[], board: PlayerBoard): number {
  const land = boardCells.map(hexKey).filter((key) => board.stacks[key]?.at(-1) !== 'water');
  return connectedGroups(land).length;
}

/** Every island scores 5. */
export function scoreIslands(boardCells: readonly Hex[], board: PlayerBoard): number {
  return countIslands(boardCells, board) * ISLAND_POINTS;
}

function waterPoints(
  config: Pick<HarmoniesSetup, 'boardCells' | 'waterScoring'>,
  board: PlayerBoard,
  water: readonly string[],
): number {
  switch (config.waterScoring) {
    case 'islands':
      return scoreIslands(config.boardCells, board);
    case 'river':
      return longestRiverPoints(water);
  }
}

export function scoreWater(
  config: Pick<HarmoniesSetup, 'boardCells' | 'waterScoring'>,
  board: PlayerBoard,
): number {
  return waterPoints(config, board, sortByKind(board).water);
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
  const sorted = sortByKind(board);
  const parts = {
    trees: treePoints(board, sorted.tree),
    mountains: mountainPoints(board, sorted.mountain),
    fields: fieldPoints(sorted.field),
    buildings: buildingPoints(board, sorted.building),
    water: waterPoints(config, board, sorted.water),
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
