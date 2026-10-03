import { classifyStack, hasCube, stackAt, type PlayerBoard } from '../domain/board.js';
import {
  TERRAIN_KIND_OF,
  getAnimalSlot,
  type AnimalCard,
  type HabitatCell,
} from '../domain/cards.js';
import { HEX_ROTATIONS, addHex, parseHexKey, type Hex } from '../domain/hex.js';

/**
 * Exact terrain and exact height. Cells off the board never hold a stack, so they can never
 * satisfy a requirement.
 */
function satisfies(
  board: PlayerBoard,
  cell: Hex,
  required: Pick<HabitatCell, 'terrain' | 'height'>,
): boolean {
  const terrain = classifyStack(stackAt(board, cell));
  return (
    terrain !== null &&
    terrain.kind === TERRAIN_KIND_OF[required.terrain] &&
    terrain.height === required.height
  );
}

/**
 * True if the card's whole habitat is on the board with its animal slot at `cell`: every cell
 * of the pattern in its exact place relative to the slot, in one of the six rotations. Mirror
 * images do not count. Says nothing about whether `cell` is free.
 */
export function habitatMatchesAt(board: PlayerBoard, card: AnimalCard, cell: Hex): boolean {
  const slot = getAnimalSlot(card);
  if (!satisfies(board, cell, slot)) return false;

  const others = card.habitat.cells.filter((part) => !part.animalSlot);
  return HEX_ROTATIONS.some((rotate) =>
    others.every((part) =>
      satisfies(board, addHex(cell, rotate({ q: part.q - slot.q, r: part.r - slot.r })), part),
    ),
  );
}

/** Cells where a cube from this card may be placed right now: a matching, unoccupied slot. */
export function getCubeTargets(board: PlayerBoard, card: AnimalCard): Hex[] {
  return Object.keys(board.stacks)
    .map(parseHexKey)
    .filter((cell) => !hasCube(board, cell) && habitatMatchesAt(board, card, cell));
}
