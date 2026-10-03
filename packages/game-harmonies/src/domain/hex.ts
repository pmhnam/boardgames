/** Axial hex coordinates (flat-top layout: q is the column). */
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

export const HEX_DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function addHex(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexNeighbours(hex: Hex): Hex[] {
  return HEX_DIRECTIONS.map((direction) => addHex(hex, direction));
}

/** Rotates a vector by 60 degrees around the origin. */
function rotate60(hex: Hex): Hex {
  return { q: -hex.r, r: hex.q + hex.r };
}

function reflect(hex: Hex): Hex {
  return { q: hex.r, r: hex.q };
}

/** The 12 symmetries of the hex grid (6 rotations, each optionally mirrored). */
export const HEX_SYMMETRIES: ReadonlyArray<(hex: Hex) => Hex> = [false, true].flatMap((mirror) =>
  [0, 1, 2, 3, 4, 5].map((turns) => (hex: Hex): Hex => {
    let result = mirror ? reflect(hex) : hex;
    for (let i = 0; i < turns; i++) result = rotate60(result);
    return result;
  }),
);
