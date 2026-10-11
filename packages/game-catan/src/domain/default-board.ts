import type { HexSideRef } from './coast.js';
import type { Hex, VertexCorner } from './hex.js';
import type { Resource, Terrain } from './resources.js';

export interface Tile {
  terrain: Terrain;
  /** The roll that makes this hex produce. Null on a desert. */
  number: number | null;
}

/** `any` trades any one kind of resource at the generic port rate. */
export type PortType = Resource | 'any';

/** A port on a sea frame piece: how many edges along the piece it sits, and what it trades. */
export interface FramePort {
  at: number;
  type: PortType;
}

/** One piece of the sea frame: a stretch of coast with the ports printed on it. */
export interface FramePiece {
  /** How many edges of the coast the piece covers. */
  length: number;
  ports: FramePort[];
}

/**
 * The sea frame. Its pieces are laid end to end clockwise from `start`: in the order given for
 * the fixed setup. The variable setup shuffles them, each piece taking the place of one of its
 * own length.
 */
export interface Frame {
  start: HexSideRef;
  pieces: FramePiece[];
}

/** The top or the bottom corner of a hex. */
export interface HexCornerRef extends Hex {
  corner: VertexCorner;
}

export interface StartingPlacement {
  settlement: HexCornerRef;
  road: HexSideRef;
}

/** The pieces one seat starts the fixed setup with. The second settlement collects cards. */
export interface StartingPieces {
  first: StartingPlacement;
  second: StartingPlacement;
}

/** The board for a first game: every hex, and every player's two settlements and roads. */
export interface FixedSetup {
  /** One tile per hex, in the order of the config's hexes. */
  tiles: Tile[];
  /** In seat order. A three-player game uses the first three. */
  seats: StartingPieces[];
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

/** The number discs in the order of the letters on their backs, A to R. */
export const DEFAULT_NUMBER_DISCS = [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11];

/** Six pieces of five edges each; the ones with two ports alternate with the ones with one. */
export const DEFAULT_FRAME: Frame = {
  start: { q: 0, r: -2, side: 'NW' },
  pieces: [
    {
      length: 5,
      ports: [
        { at: 0, type: 'any' },
        { at: 3, type: 'wool' },
      ],
    },
    { length: 5, ports: [{ at: 2, type: 'any' }] },
    {
      length: 5,
      ports: [
        { at: 0, type: 'any' },
        { at: 3, type: 'brick' },
      ],
    },
    { length: 5, ports: [{ at: 2, type: 'wood' }] },
    {
      length: 5,
      ports: [
        { at: 0, type: 'any' },
        { at: 3, type: 'wheat' },
      ],
    },
    { length: 5, ports: [{ at: 2, type: 'ore' }] },
  ],
};

/** The island for five and six players: rows of 3, 4, 5, 6, 5, 4 and 3 hexes. */
export const EXTENSION_HEXES: Hex[] = [];
for (let r = -3; r <= 3; r += 1) {
  for (let q = Math.max(-3, -3 - r); q <= Math.min(2, 2 - r); q += 1) {
    EXTENSION_HEXES.push({ q, r });
  }
}

/** The base game's hexes with the extension's eleven: two of each terrain and a second desert. */
export const EXTENSION_TERRAIN_COUNTS: Record<Terrain, number> = {
  hills: 5,
  forest: 6,
  pasture: 6,
  fields: 6,
  mountains: 5,
  desert: 2,
};

/** The extension's number discs in the order of the letters on their backs, A to Zc. */
export const EXTENSION_NUMBER_DISCS = [
  2, 5, 4, 6, 3, 9, 8, 11, 11, 10, 6, 3, 8, 4, 8, 10, 11, 12, 10, 5, 4, 9, 5, 9, 12, 3, 2, 6,
];

/**
 * The base game's six pieces with the extension's four short ones, which lengthen the four
 * long sides of the island. Two of the short pieces carry a port.
 */
export const EXTENSION_FRAME: Frame = {
  start: { q: 0, r: -3, side: 'NW' },
  pieces: [
    {
      length: 5,
      ports: [
        { at: 0, type: 'any' },
        { at: 3, type: 'wool' },
      ],
    },
    { length: 5, ports: [{ at: 2, type: 'any' }] },
    { length: 2, ports: [] },
    {
      length: 5,
      ports: [
        { at: 0, type: 'any' },
        { at: 3, type: 'brick' },
      ],
    },
    { length: 2, ports: [{ at: 0, type: 'wool' }] },
    { length: 5, ports: [{ at: 2, type: 'wood' }] },
    {
      length: 5,
      ports: [
        { at: 0, type: 'any' },
        { at: 3, type: 'wheat' },
      ],
    },
    { length: 2, ports: [] },
    { length: 5, ports: [{ at: 2, type: 'ore' }] },
    { length: 2, ports: [{ at: 0, type: 'any' }] },
  ],
};

const tile = (terrain: Terrain, number: number | null = null): Tile => ({ terrain, number });

/** A settlement on top of a hex with its road down the upper-left side of that hex. */
const onTop = (q: number, r: number): StartingPlacement => ({
  settlement: { q, r, corner: 'N' },
  road: { q, r, side: 'NW' },
});

/** The fixed setup of the 6th edition rulebook, in the order of `DEFAULT_HEXES`. */
export const DEFAULT_FIXED_SETUP: FixedSetup = {
  tiles: [
    tile('desert'),
    tile('fields', 8),
    tile('pasture', 11),

    tile('hills', 6),
    tile('pasture', 3),
    tile('forest', 4),
    tile('mountains', 9),

    tile('forest', 10),
    tile('fields', 5),
    tile('hills', 12),
    tile('forest', 11),
    tile('pasture', 5),

    tile('fields', 2),
    tile('hills', 9),
    tile('mountains', 4),
    tile('forest', 8),

    tile('mountains', 6),
    tile('fields', 3),
    tile('pasture', 10),
  ],
  // Red, blue, orange, white: a three-player game leaves the white pieces in the box.
  seats: [
    { first: onTop(-2, 2), second: onTop(1, -1) },
    { first: onTop(1, 1), second: onTop(-1, 2) },
    {
      first: { settlement: { q: 1, r: 0, corner: 'N' }, road: { q: 1, r: -1, side: 'E' } },
      second: onTop(-1, 0),
    },
    { first: onTop(0, 2), second: onTop(-1, 1) },
  ],
};
