import type { Hex, HexSide } from './hex.js';
import type { Resource, Terrain } from './resources.js';

export interface Tile {
  terrain: Terrain;
  /** The roll that makes this hex produce. Null on a desert. */
  number: number | null;
}

/** `any` trades any one kind of resource at the generic harbor rate. */
export type HarborType = Resource | 'any';

/** A harbor as a config places it: on the side of a coastal hex that faces the sea. */
export interface HarborPlacement extends Hex {
  side: HexSide;
  type: HarborType;
}

const RADIUS = 2;

/** The island: rows of 3, 4, 5, 4 and 3 hexes, listed top to bottom, left to right. */
export const DEFAULT_HEXES: Hex[] = [];
for (let r = -RADIUS; r <= RADIUS; r += 1) {
  for (let q = Math.max(-RADIUS, -RADIUS - r); q <= Math.min(RADIUS, RADIUS - r); q += 1) {
    DEFAULT_HEXES.push({ q, r });
  }
}

export const DEFAULT_TERRAIN_COUNTS: Record<Terrain, number> = {
  hills: 3,
  forest: 4,
  pasture: 4,
  fields: 4,
  mountains: 3,
  desert: 1,
};

export const DEFAULT_NUMBER_TOKENS = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

const tile = (terrain: Terrain, number: number | null = null): Tile => ({ terrain, number });

/** The fixed board for a first game, in the order of `DEFAULT_HEXES`. */
export const DEFAULT_BEGINNER_TILES: Tile[] = [
  tile('mountains', 10),
  tile('pasture', 2),
  tile('forest', 9),

  tile('fields', 12),
  tile('hills', 6),
  tile('pasture', 4),
  tile('hills', 10),

  tile('fields', 9),
  tile('forest', 11),
  tile('desert'),
  tile('forest', 3),
  tile('mountains', 8),

  tile('forest', 8),
  tile('mountains', 3),
  tile('fields', 4),
  tile('pasture', 5),

  tile('hills', 5),
  tile('fields', 6),
  tile('pasture', 11),
];

/** Nine harbors around the coast, clockwise from the top left. */
export const DEFAULT_HARBORS: HarborPlacement[] = [
  { q: 0, r: -2, side: 'NW', type: 'any' },
  { q: 1, r: -2, side: 'NE', type: 'grain' },
  { q: 2, r: -1, side: 'NE', type: 'ore' },
  { q: 2, r: 0, side: 'E', type: 'any' },
  { q: 1, r: 1, side: 'SE', type: 'wool' },
  { q: 0, r: 2, side: 'SE', type: 'any' },
  { q: -1, r: 2, side: 'SW', type: 'any' },
  { q: -2, r: 1, side: 'W', type: 'brick' },
  { q: -1, r: -1, side: 'W', type: 'wood' },
];
