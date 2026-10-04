import { hexDistance, hexKey, type Hex } from './hex.js';

/** The six directions out from a hex, counterclockwise from the upper right. */
const DIRECTIONS: Hex[] = [
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 0 },
];

export const CORNER_COUNT = DIRECTIONS.length;

const farthest = (from: Hex, hexes: readonly Hex[]) =>
  Math.max(...hexes.map((hex) => hexDistance(from, hex)));

/** The hex nearest to every other: the middle of the island. */
export function findCentre(hexes: readonly Hex[]): Hex {
  const [centre] = [...hexes].sort(
    (a, b) => farthest(a, hexes) - farthest(b, hexes) || hexKey(a).localeCompare(hexKey(b)),
  );
  if (!centre) throw new Error('The board has no hexes');
  return centre;
}

/**
 * The hexes in the order the number discs are laid: from one corner of the island,
 * counterclockwise round the outside, then round each ring inside it, ending in the middle.
 */
export function listSpiral(hexes: readonly Hex[], corner: number): Hex[] {
  const onBoard = new Set(hexes.map(hexKey));
  const centre = findCentre(hexes);
  const spiral: Hex[] = [];
  const start = DIRECTIONS[corner % CORNER_COUNT] as Hex;

  for (let ring = farthest(centre, hexes); ring >= 1; ring -= 1) {
    let hex = { q: centre.q + ring * start.q, r: centre.r + ring * start.r };
    for (let side = 0; side < CORNER_COUNT; side += 1) {
      const step = DIRECTIONS[(corner + 2 + side) % CORNER_COUNT] as Hex;
      for (let walked = 0; walked < ring; walked += 1) {
        if (onBoard.has(hexKey(hex))) spiral.push(hex);
        hex = { q: hex.q + step.q, r: hex.r + step.r };
      }
    }
  }
  spiral.push(centre);
  return spiral;
}
