import { NO_STACK, isTerrain, type PlayerBoard } from '../domain/board.js';
import {
  TERRAIN_KIND_OF,
  getHabitatShape,
  type AnimalCard,
  type HabitatCell,
  type HabitatShape,
} from '../domain/cards.js';
import { hexKey, hexKeyAt, knownHex, type Hex } from '../domain/hex.js';

/**
 * Exact terrain and exact height. Cells off the board never hold a stack, so they can never
 * satisfy a requirement.
 */
function satisfies(
  board: PlayerBoard,
  key: string,
  required: Pick<HabitatCell, 'terrain' | 'height'>,
): boolean {
  return isTerrain(
    board.stacks[key] ?? NO_STACK,
    TERRAIN_KIND_OF[required.terrain],
    required.height,
  );
}

/** The rest of a habitat around a slot already known to be right, in any of the rotations. */
function othersMatchAround(board: PlayerBoard, shape: HabitatShape, cell: Hex): boolean {
  return shape.rotations.some((offsets) =>
    shape.others.every((part, index) => {
      const offset = offsets[index];
      return (
        offset !== undefined &&
        satisfies(board, hexKeyAt(cell.q + offset.q, cell.r + offset.r), part)
      );
    }),
  );
}

/**
 * True if the card's whole habitat is on the board with its animal slot at `cell`: every cell
 * of the pattern in its exact place relative to the slot, in one of the six rotations. Mirror
 * images do not count. Says nothing about whether `cell` is free.
 */
export function habitatMatchesAt(board: PlayerBoard, card: AnimalCard, cell: Hex): boolean {
  const shape = getHabitatShape(card);
  return satisfies(board, hexKey(cell), shape.slot) && othersMatchAround(board, shape, cell);
}

/** Cells where a cube from this card may be placed right now: a matching, unoccupied slot. */
export function getCubeTargets(board: PlayerBoard, card: AnimalCard): Hex[] {
  const shape = getHabitatShape(card);
  const slotKind = TERRAIN_KIND_OF[shape.slot.terrain];
  const targets: Hex[] = [];
  for (const key of Object.keys(board.stacks)) {
    // The cheapest question first: most stacks are not what the animal stands on.
    const stack = board.stacks[key] ?? NO_STACK;
    if (!isTerrain(stack, slotKind, shape.slot.height) || board.cubes.includes(key)) continue;
    const cell = knownHex(key);
    if (othersMatchAround(board, shape, cell)) targets.push({ q: cell.q, r: cell.r });
  }
  return targets;
}
