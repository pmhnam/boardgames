/** Axial hex coordinates (flat-top layout: q is the column). */
export interface Hex {
  q: number;
  r: number;
}

// A key is asked for far more often than a cell is new: the bot alone asks for millions in a
// turn. So the keys of every cell a board could have are made once, and a cell read back
// from its key is remembered.
const KEY_SPAN = 24;
const KEYS: readonly string[][] = Array.from({ length: KEY_SPAN * 2 }, (_, q) =>
  Array.from({ length: KEY_SPAN * 2 }, (_, r) => `${q - KEY_SPAN},${r - KEY_SPAN}`),
);

/** `hexKey` for a cell given by its two numbers, without making the cell. */
export function hexKeyAt(q: number, r: number): string {
  return KEYS[q + KEY_SPAN]?.[r + KEY_SPAN] ?? `${q},${r}`;
}

export function hexKey(hex: Hex): string {
  return hexKeyAt(hex.q, hex.r);
}

export function parseHexKey(key: string): Hex {
  const [q, r] = key.split(',').map(Number);
  return { q: q ?? 0, r: r ?? 0 };
}

const KNOWN_HEXES = new Map<string, Hex>();
const KNOWN_HEXES_LIMIT = 4096;

/**
 * `parseHexKey`, remembered. Every caller of one key gets the same cell, frozen, so this is
 * for code that only reads it; anything handed on to a caller should come from `parseHexKey`.
 */
export function knownHex(key: string): Hex {
  const known = KNOWN_HEXES.get(key);
  if (known) return known;
  const hex = Object.freeze(parseHexKey(key));
  if (KNOWN_HEXES.size < KNOWN_HEXES_LIMIT) KNOWN_HEXES.set(key, hex);
  return hex;
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

const NEIGHBOUR_KEYS = new Map<string, readonly string[]>();

/**
 * The keys of the six cells around the one with this key, in the order of `HEX_DIRECTIONS`.
 * Remembered: scoring walks from cell to neighbour for every board the bot weighs up.
 */
export function neighbourKeys(key: string): readonly string[] {
  const known = NEIGHBOUR_KEYS.get(key);
  if (known) return known;
  const hex = knownHex(key);
  const keys = HEX_DIRECTIONS.map((direction) =>
    hexKeyAt(hex.q + direction.q, hex.r + direction.r),
  );
  if (NEIGHBOUR_KEYS.size < KNOWN_HEXES_LIMIT) NEIGHBOUR_KEYS.set(key, keys);
  return keys;
}

/** Rotates a vector by 60 degrees around the origin. */
function rotate60(hex: Hex): Hex {
  return { q: -hex.r, r: hex.q + hex.r };
}

/** The six rotations of the hex grid. Mirror images are deliberately not included. */
export const HEX_ROTATIONS: ReadonlyArray<(hex: Hex) => Hex> = [0, 1, 2, 3, 4, 5].map(
  (turns) =>
    (hex: Hex): Hex => {
      let result = hex;
      for (let i = 0; i < turns; i++) result = rotate60(result);
      return result;
    },
);
