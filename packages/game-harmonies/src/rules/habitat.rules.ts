import { classifyStack, hasCube, stackAt, type PlayerBoard } from '../domain/board.js';
import type { AnimalCard, TerrainRequirement } from '../domain/cards.js';
import { HEX_SYMMETRIES, addHex, parseHexKey, type Hex } from '../domain/hex.js';

/** Cells off the board never hold a stack, so they can never satisfy a requirement. */
function satisfies(board: PlayerBoard, cell: Hex, requirement: TerrainRequirement): boolean {
  const terrain = classifyStack(stackAt(board, cell));
  if (terrain === null || terrain.kind !== requirement.kind) return false;
  return requirement.height === undefined || terrain.height === requirement.height;
}

/**
 * True if the card's habitat exists with its cube cell at `cell`, in any rotation or mirror
 * image. Says nothing about whether `cell` is free.
 */
export function habitatMatchesAt(board: PlayerBoard, card: AnimalCard, cell: Hex): boolean {
  if (!satisfies(board, cell, card.cubeOn)) return false;
  return HEX_SYMMETRIES.some((transform) =>
    card.habitat.every((part) =>
      satisfies(board, addHex(cell, transform(part.offset)), part.requires),
    ),
  );
}

/** Cells where a cube from this card may be placed right now. */
export function getCubeTargets(board: PlayerBoard, card: AnimalCard): Hex[] {
  return Object.keys(board.stacks)
    .map(parseHexKey)
    .filter((cell) => !hasCube(board, cell) && habitatMatchesAt(board, card, cell));
}
