import { hexKey, hexNeighbours, type Hex } from './hex.js';

/** The six directions out from the middle of the island, counterclockwise from the upper right. */
const DIRECTIONS: Hex[] = [
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 0 },
];

export const CORNER_COUNT = DIRECTIONS.length;

/**
 * Where a hex lies, in whole numbers so that every comparison below is exact: `x` counts half
 * hexes to the east and `y` rows to the north, which leaves `y` short by a factor of √3.
 */
interface Point {
  x: number;
  y: number;
}

const pointOf = (hex: Hex): Point => ({ x: 2 * hex.q + hex.r, y: -hex.r });

/** Positive when `b` lies counterclockwise of `a`. */
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;

/** How far `b` reaches in the direction of `a`, with the missing √3 put back. */
const dot = (a: Point, b: Point) => a.x * b.x + 3 * a.y * b.y;

/** The island as the layers of an onion: the hexes on the coast, then the coast inside them. */
function peel(hexes: readonly Hex[]): Hex[][] {
  const layers: Hex[][] = [];
  let left = [...hexes];
  while (left.length > 0) {
    const inside = new Set(left.map(hexKey));
    const isOutside = (hex: Hex) =>
      hexNeighbours(hex).some((neighbour) => !inside.has(hexKey(neighbour)));
    layers.push(left.filter(isOutside));
    left = left.filter((hex) => !isOutside(hex));
  }
  return layers;
}

/** One layer, counterclockwise from the hex of it that lies farthest towards a corner. */
function walkLayer(layer: readonly Hex[], corner: number): Hex[] {
  // Measured from the middle of the layer, and scaled by its size to stay in whole numbers.
  const points = layer.map(pointOf);
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y }), {
    x: 0,
    y: 0,
  });
  const placed = layer.map((hex, index) => {
    const point = points[index] as Point;
    return {
      hex,
      key: hexKey(hex),
      at: { x: layer.length * point.x - sum.x, y: layer.length * point.y - sum.y },
    };
  });

  const towards = pointOf(DIRECTIONS[corner % CORNER_COUNT] as Hex);
  const [start] = [...placed].sort(
    (a, b) => dot(towards, b.at) - dot(towards, a.at) || a.key.localeCompare(b.key),
  );
  if (!start) return [];

  // The first half turn from the start comes before the second; within one, a hex comes
  // before any that lies counterclockwise of it.
  const halfTurn = (at: Point) => {
    const side = cross(start.at, at);
    return side > 0 || (side === 0 && dot(start.at, at) >= 0) ? 0 : 1;
  };
  return placed
    .sort(
      (a, b) =>
        halfTurn(a.at) - halfTurn(b.at) ||
        cross(b.at, a.at) ||
        dot(start.at, b.at) - dot(start.at, a.at) ||
        a.key.localeCompare(b.key),
    )
    .map((entry) => entry.hex);
}

/**
 * The hexes in the order the number discs are laid: from one corner of the island,
 * counterclockwise round the outside, then round each layer inside it, ending in the middle.
 */
export function listSpiral(hexes: readonly Hex[], corner: number): Hex[] {
  return peel(hexes).flatMap((layer) => walkLayer(layer, corner));
}
