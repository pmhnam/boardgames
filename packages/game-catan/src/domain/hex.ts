/** Axial coordinates on a pointy-top layout: `q` runs east, `r` runs south-east. */
export interface Hex {
  q: number;
  r: number;
}

export function hexKey(hex: Hex): string {
  return `${hex.q},${hex.r}`;
}

export function parseHexKey(key: string): Hex {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

/** The sides of a hex, clockwise from the upper right. */
export const HEX_SIDES = ['NE', 'E', 'SE', 'SW', 'W', 'NW'] as const;
export type HexSide = (typeof HEX_SIDES)[number];

export function isHexSide(value: unknown): value is HexSide {
  return HEX_SIDES.includes(value as HexSide);
}

const SIDE_OFFSETS: Record<HexSide, Hex> = {
  NE: { q: 1, r: -1 },
  E: { q: 1, r: 0 },
  SE: { q: 0, r: 1 },
  SW: { q: -1, r: 1 },
  W: { q: -1, r: 0 },
  NW: { q: 0, r: -1 },
};

export function hexNeighbour(hex: Hex, side: HexSide): Hex {
  const offset = SIDE_OFFSETS[side];
  return { q: hex.q + offset.q, r: hex.r + offset.r };
}

export function hexNeighbours(hex: Hex): Hex[] {
  return HEX_SIDES.map((side) => hexNeighbour(hex, side));
}

/** Where a vertex sits on the hex that names it: its top or its bottom corner. */
export type VertexCorner = 'N' | 'S';

/**
 * Every corner on the board is the top or the bottom corner of exactly one hex (which may lie
 * off the board), and that is its id. Three hexes meeting at a corner all agree on it.
 */
function vertexId(q: number, r: number, corner: VertexCorner): string {
  return `${q},${r},${corner}`;
}

/** The id of the top or bottom corner of a hex. */
export function hexCorner(hex: Hex, corner: VertexCorner): string {
  return vertexId(hex.q, hex.r, corner);
}

export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function parseVertexId(id: string): { hex: Hex; corner: VertexCorner } | null {
  const [q, r, corner] = id.split(',');
  if (q === undefined || r === undefined || (corner !== 'N' && corner !== 'S')) return null;
  return { hex: { q: Number(q), r: Number(r) }, corner };
}

/** The six corners of a hex, clockwise from the top. */
export function hexCorners(hex: Hex): string[] {
  const { q, r } = hex;
  return [
    vertexId(q, r, 'N'),
    vertexId(q + 1, r - 1, 'S'),
    vertexId(q, r + 1, 'N'),
    vertexId(q, r, 'S'),
    vertexId(q - 1, r + 1, 'N'),
    vertexId(q, r - 1, 'S'),
  ];
}

/** An edge is named by the two corners it joins, in a fixed order. */
export function edgeId(a: string, b: string): string {
  return a < b ? `${a}/${b}` : `${b}/${a}`;
}

export function parseEdgeId(id: string): [string, string] | null {
  const [a, b, ...rest] = id.split('/');
  if (a === undefined || b === undefined || rest.length > 0) return null;
  return [a, b];
}

/** The edge on one side of a hex. Side `i` joins corners `i` and `i + 1`. */
export function hexSideEdge(hex: Hex, side: HexSide): string {
  const corners = hexCorners(hex);
  const index = HEX_SIDES.indexOf(side);
  return edgeId(corners[index] as string, corners[(index + 1) % corners.length] as string);
}
