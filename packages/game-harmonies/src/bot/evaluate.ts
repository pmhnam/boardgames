import { classifyStack, hasCube, stackAt, type PlayerBoard } from '../domain/board.js';
import {
  TERRAIN_KIND_OF,
  getAnimalSlot,
  type AnimalCard,
  type HabitatCell,
} from '../domain/cards.js';
import { END_TRIGGER_EMPTY_CELLS } from '../domain/config.js';
import { HEX_ROTATIONS, addHex, hexKey, hexNeighbours, parseHexKey } from '../domain/hex.js';
import type { TokenColor } from '../domain/tokens.js';
import { calculateBoardScore } from '../scoring/score.js';
import { cardsInProgress, type BotContext } from './model.js';

/** How much of an unplaced animal's next score step a nearly built habitat is worth. */
const HABITAT_WEIGHT = 0.7;
/** What an empty cell contributes towards a habitat: it could still become anything. */
const EMPTY_FIT = 0.25;

/**
 * How well a stack serves a habitat cell: 1 when it is exactly right, between 0 and 1 when it
 * can still be built into it, 0 when it never can.
 */
function fit(stack: readonly TokenColor[], required: HabitatCell, blocked: boolean): number {
  const terrain = classifyStack(stack);
  if (
    terrain !== null &&
    terrain.kind === TERRAIN_KIND_OF[required.terrain] &&
    terrain.height === required.height
  ) {
    return 1;
  }
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

/** 0 to 1: how close the board is to offering one more place for this card's animal. */
function habitatProgress(context: BotContext, board: PlayerBoard, card: AnimalCard): number {
  const slot = getAnimalSlot(card);
  const others = card.habitat.cells.filter((cell) => !cell.animalSlot);
  let best = 0;

  for (const anchor of context.boardCells) {
    if (hasCube(board, anchor)) continue;
    const slotFit = fit(stackAt(board, anchor), slot, false);
    if (slotFit === 0) continue;

    for (const rotate of HEX_ROTATIONS) {
      let total = slotFit;
      for (const part of others) {
        const cell = addHex(anchor, rotate({ q: part.q - slot.q, r: part.r - slot.r }));
        const partFit = context.onBoard.has(hexKey(cell))
          ? fit(stackAt(board, cell), part, hasCube(board, cell))
          : 0;
        if (partFit === 0) {
          total = 0;
          break;
        }
        total += partFit;
      }
      best = Math.max(best, total / card.habitat.cells.length);
    }
  }
  return best;
}

function habitatPotential(context: BotContext, board: PlayerBoard): number {
  let potential = 0;
  for (const card of cardsInProgress(context, board)) {
    const placed = board.cards.find((owned) => owned.cardId === card.id)?.cubesPlaced ?? 0;
    const nextStep =
      (card.pointsByAnimalsPlaced[placed + 1] ?? 0) - (card.pointsByAnimalsPlaced[placed] ?? 0);
    const progress = habitatProgress(context, board, card);
    // Squared: a habitat that is almost there is worth far more than a vague start.
    potential += nextStep * progress * progress * HABITAT_WEIGHT;
  }
  return potential;
}

/** Points that unfinished stacks are on their way to, which the score does not show yet. */
function structurePotential(board: PlayerBoard): number {
  let potential = 0;
  for (const [key, stack] of Object.entries(board.stacks)) {
    const cell = parseHexKey(key);
    if (hasCube(board, cell)) continue;
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
