import { HEX_SIDES, hexKey, hexNeighbour, hexSideEdge, type Hex, type HexSide } from './hex.js';

/** One side of one hex. */
export interface HexSideRef extends Hex {
  side: HexSide;
}

/**
 * The edges of the coast in clockwise order, starting from one of them. Null when the start is
 * not on the coast, or when the coast is not a single ring: an island with a lake in it, or
 * two islands.
 */
export function listCoast(hexes: readonly Hex[], start: HexSideRef): string[] | null {
  const onBoard = new Set(hexes.map(hexKey));
  const isCoastal = (hex: Hex, side: HexSide) =>
    onBoard.has(hexKey(hex)) && !onBoard.has(hexKey(hexNeighbour(hex, side)));
  if (!isCoastal(start, start.side)) return null;

  const total = hexes.reduce(
    (sum, hex) => sum + HEX_SIDES.filter((side) => isCoastal(hex, side)).length,
    0,
  );
  const coast: string[] = [];
  let hex: Hex = { q: start.q, r: start.r };
  let index = HEX_SIDES.indexOf(start.side);
  while (coast.length <= total) {
    coast.push(hexSideEdge(hex, HEX_SIDES[index] as HexSide));
    // Round the same hex while its next side faces the sea; otherwise step onto the neighbour
    // across that side and carry on from the side of it that meets the same corner.
    const next = HEX_SIDES[(index + 1) % HEX_SIDES.length] as HexSide;
    if (isCoastal(hex, next)) {
      index = (index + 1) % HEX_SIDES.length;
    } else {
      hex = hexNeighbour(hex, next);
      index = (index + HEX_SIDES.length - 1) % HEX_SIDES.length;
    }
    if (hexKey(hex) === hexKey(start) && HEX_SIDES[index] === start.side) break;
  }
  return coast.length === total ? coast : null;
}
