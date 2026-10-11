import { NO_STACK, isTerrain, stackAt, type PlayerBoard } from '../domain/board.js';
import {
  TERRAIN_KIND_OF,
  getCard,
  getHabitatShape,
  isCardComplete,
  type AnimalCard,
  type HabitatCell,
} from '../domain/cards.js';
import { END_TRIGGER_EMPTY_CELLS } from '../domain/config.js';
import { hexKeyAt, hexNeighbours, knownHex } from '../domain/hex.js';
import type { TokenColor } from '../domain/tokens.js';
import type { Stack } from '../domain/board.js';
import { calculateBoardScore } from '../scoring/score.js';
import type { BotContext, HabitatPlacements } from './model.js';

/** How much of an unplaced animal's next score step a nearly built habitat is worth. */
const HABITAT_WEIGHT = 0.7;
/** What an empty cell contributes towards a habitat: it could still become anything. */
const EMPTY_FIT = 0.25;

/**
 * How well a stack serves a habitat cell: 1 when it is exactly right, between 0 and 1 when it
 * can still be built into it, 0 when it never can.
 */
function fit(stack: readonly TokenColor[], required: HabitatCell, blocked: boolean): number {
  if (isTerrain(stack, TERRAIN_KIND_OF[required.terrain], required.height)) return 1;
  // A cell holding an animal can no longer be built on.
  if (blocked) return 0;
  if (stack.length === 0) return EMPTY_FIT;

  const top = stack.at(-1);
  switch (required.terrain) {
    case 'TREE':
      // Trunks waiting for more trunks or their leaf.
      return top === 'trunk' && stack.length < required.height
        ? EMPTY_FIT + 0.5 * (stack.length / (required.height - 1))
        : 0;
    case 'MOUNTAIN':
      return top === 'mountain' && stack.length < required.height
        ? EMPTY_FIT + 0.5 * (stack.length / required.height)
        : 0;
    case 'BUILDING':
      return stack.length === 1 && (top === 'mountain' || top === 'trunk' || top === 'building')
        ? 0.6
        : 0;
    default:
      return 0;
  }
}

/** A board read once into the order of `boardCells`, so a cell is looked up by its place. */
interface CellsInOrder {
  stack: readonly Stack[];
  cube: readonly boolean[];
}

function inOrder(context: BotContext, board: PlayerBoard): CellsInOrder {
  const cube = new Array<boolean>(context.cellKeys.length).fill(false);
  for (const key of board.cubes) {
    const place = context.placeOf.get(key);
    if (place !== undefined) cube[place] = true;
  }
  return { stack: context.cellKeys.map((key) => board.stacks[key] ?? NO_STACK), cube };
}

/**
 * Where the card's habitat fits on the map at all. It depends on the map and the card only,
 * so it is worked out once for all the boards the bot weighs up in a turn.
 */
function placementsOf(context: BotContext, card: AnimalCard): HabitatPlacements {
  const known = context.habitatPlacements.get(card);
  if (known) return known;

  const { rotations } = getHabitatShape(card);
  const placements = context.boardCells.map((anchor) => {
    const fitting: number[][] = [];
    for (const offsets of rotations) {
      const places: number[] = [];
      for (const offset of offsets) {
        const place = context.placeOf.get(hexKeyAt(anchor.q + offset.q, anchor.r + offset.r));
        // Part of the habitat would hang off the map: this rotation can never be built here.
        if (place === undefined) break;
        places.push(place);
      }
      if (places.length === offsets.length) fitting.push(places);
    }
    return fitting;
  });
  context.habitatPlacements.set(card, placements);
  return placements;
}

/** 0 to 1: how close the board is to offering one more place for this card's animal. */
function habitatProgress(context: BotContext, cells: CellsInOrder, card: AnimalCard): number {
  const { slot, others } = getHabitatShape(card);
  const placements = placementsOf(context, card);
  const size = card.habitat.cells.length;
  let best = 0;

  // Plain counting loops: this is the innermost work of the bot's thinking.
  for (let anchor = 0; anchor < placements.length; anchor++) {
    const fitting = placements[anchor];
    if (fitting === undefined || cells.cube[anchor]) continue;
    const slotFit = fit(cells.stack[anchor] ?? NO_STACK, slot, false);
    if (slotFit === 0) continue;

    for (let turn = 0; turn < fitting.length; turn++) {
      const places = fitting[turn];
      if (places === undefined) continue;
      let total = slotFit;
      for (let index = 0; index < others.length; index++) {
        const part = others[index];
        const place = places[index];
        const partFit =
          part === undefined || place === undefined
            ? 0
            : fit(cells.stack[place] ?? NO_STACK, part, cells.cube[place] === true);
        if (partFit === 0) {
          total = 0;
          break;
        }
        total += partFit;
      }
      best = Math.max(best, total / size);
    }
  }
  return best;
}

function habitatPotential(context: BotContext, board: PlayerBoard): number {
  let cells: CellsInOrder | null = null;
  let potential = 0;
  for (const owned of board.cards) {
    const card = getCard(context.cards, owned.cardId);
    if (isCardComplete(card, owned.cubesPlaced)) continue;
    const placed = owned.cubesPlaced;
    const nextStep =
      (card.pointsByAnimalsPlaced[placed + 1] ?? 0) - (card.pointsByAnimalsPlaced[placed] ?? 0);
    cells ??= inOrder(context, board);
    const progress = habitatProgress(context, cells, card);
    // Squared: a habitat that is almost there is worth far more than a vague start.
    potential += nextStep * progress * progress * HABITAT_WEIGHT;
  }
  return potential;
}

/** Points that unfinished stacks are on their way to, which the score does not show yet. */
function structurePotential(board: PlayerBoard): number {
  let potential = 0;
  for (const key of Object.keys(board.stacks)) {
    if (board.cubes.includes(key)) continue;
    const stack = board.stacks[key] ?? NO_STACK;
    const cell = knownHex(key);
    const top = stack.at(-1);

    if (top === 'trunk') {
      // One leaf away from a tree of 3 or 7 points.
      potential += stack.length === 1 ? 1.2 : 2.6;
    } else if (top === 'building' && stack.length === 1) {
      potential += 0.4;
    } else if (top === 'field' || top === 'mountain') {
      const kind = top;
      const hasPartner = hexNeighbours(cell).some(
        (neighbour) => stackAt(board, neighbour).at(-1) === kind,
      );
      // A lone field or mountain scores nothing until it gets a neighbour of its kind.
      if (!hasPartner) potential += kind === 'field' ? 1.5 : 0.5 * stack.length;
    }
  }
  return potential;
}

/** Room left to build in: every empty cell is a future stack. */
function roomPotential(context: BotContext, board: PlayerBoard): number {
  if (context.emptyCellValue === 0) return 0;
  const empty = context.boardCells.filter((cell) => stackAt(board, cell).length === 0).length;
  return empty * context.emptyCellValue;
}

/** The bot's opinion of a board: what it scores now plus what it is building towards. */
export function evaluate(context: BotContext, board: PlayerBoard): number {
  return (
    calculateBoardScore(context, board).total +
    structurePotential(board) +
    habitatPotential(context, board) +
    roomPotential(context, board)
  );
}

const MAX_EMPTY_CELL_VALUE = 4;
const TOKENS_PER_TURN = 3;
/** Roughly how many new cells a player covers per turn when not trying to stack. */
const CELLS_COVERED_PER_TURN = 2.2;

/**
 * How many more turns the bot can expect: until the pouch runs dry, or until the opponent
 * closest to filling their board ends the game, whichever comes first.
 */
export function estimateTurnsLeft(input: {
  pouchCount: number;
  playerCount: number;
  /** Empty cells on each opponent's board. */
  opponentEmptyCells: number[];
  finalRound: boolean;
}): number {
  if (input.finalRound) return 0;
  const byPouch = input.pouchCount / TOKENS_PER_TURN / input.playerCount;
  const byBoards = input.opponentEmptyCells.map(
    (empty) => Math.max(0, empty - END_TRIGGER_EMPTY_CELLS) / CELLS_COVERED_PER_TURN,
  );
  return Math.min(byPouch, ...byBoards);
}

/**
 * How much an empty cell is worth to a player who looks ahead. When more tokens are still to
 * come than there are cells to put them on, the board will fill up before the game ends, so
 * spreading out is costly and stacking is not. When turns are the scarcer thing, room is worth
 * nothing and every cell should be used.
 */
export function emptyCellValue(input: {
  emptyCells: number;
  turnsLeft: number;
  weight: number;
}): number {
  const tokensToCome = input.turnsLeft * TOKENS_PER_TURN;
  const scarcity = tokensToCome / Math.max(input.emptyCells, 1);
  return Math.min(MAX_EMPTY_CELL_VALUE, Math.max(0, (scarcity - 1) * input.weight));
}
