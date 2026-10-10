import {
  parseEdgeId,
  parseVertexId,
  type DevelopmentCardType,
  type PortType,
  type Hex,
  type Resource,
  type Terrain,
} from '@bgp/game-catan';
import type { IconName } from './art/icons';

export const TERRAIN_FILL: Record<Terrain, string> = {
  hills: '#c56a43',
  forest: '#3f7d45',
  pasture: '#9bcb62',
  fields: '#e6c34a',
  mountains: '#8b919c',
  desert: '#dccba0',
};

/** How a tile is painted: lit from the top, with its artwork in a tone of its own colour. */
export const TERRAIN_ART: Record<Terrain, { light: string; dark: string; ink: string }> = {
  hills: { light: '#dc8052', dark: '#b4552f', ink: '#7d3118' },
  forest: { light: '#4f9d5c', dark: '#2c6e3d', ink: '#164a27' },
  pasture: { light: '#b7e07a', dark: '#86bf50', ink: '#fbf8ec' },
  fields: { light: '#f7da6b', dark: '#e0b233', ink: '#a2760d' },
  mountains: { light: '#aab0bb', dark: '#757c8a', ink: '#474d59' },
  desert: { light: '#eedfb6', dark: '#d6bf86', ink: '#a48a4e' },
};

export const TERRAIN_LABEL: Record<Terrain, string> = {
  hills: 'Hills',
  forest: 'Forest',
  pasture: 'Pasture',
  fields: 'Fields',
  mountains: 'Mountains',
  desert: 'Desert',
};

export const RESOURCE_FILL: Record<Resource, string> = {
  brick: TERRAIN_FILL.hills,
  wood: TERRAIN_FILL.forest,
  wool: TERRAIN_FILL.pasture,
  wheat: TERRAIN_FILL.fields,
  ore: TERRAIN_FILL.mountains,
};

/** Text on a chip of that colour: dark on the light ones, white on the rest. */
export const RESOURCE_INK: Record<Resource, string> = {
  brick: '#fff',
  wood: '#fff',
  wool: '#1c1d1f',
  wheat: '#1c1d1f',
  ore: '#fff',
};

export const RESOURCE_LABEL: Record<Resource, string> = {
  brick: 'Brick',
  wood: 'Wood',
  wool: 'Wool',
  wheat: 'Wheat',
  ore: 'Ore',
};

export const CARD_LABEL: Record<DevelopmentCardType, string> = {
  knight: 'Knight',
  victoryPoint: 'Victory Point',
  roadBuilding: 'Road Building',
  invention: 'Invention',
  monopoly: 'Monopoly',
};

export const CARD_ICON: Record<DevelopmentCardType, IconName> = {
  knight: 'knight',
  victoryPoint: 'star',
  roadBuilding: 'road',
  invention: 'invention',
  monopoly: 'monopoly',
};

export const CARD_HINT: Record<DevelopmentCardType, string> = {
  knight: 'Move the robber and rob a player next to it.',
  victoryPoint: 'Worth 1 point. Stays hidden until you win.',
  roadBuilding: 'Place 2 roads for free.',
  invention: 'Take any 2 cards from the supply.',
  monopoly: 'Every other player gives you all their cards of one resource.',
};

export function portLabel(type: PortType): string {
  return type === 'any' ? '3:1' : '2:1';
}

/** One colour per seat, in seat order. Every piece is outlined, so the light one shows too. */
const PLAYER_COLORS = ['#d9433b', '#2f6fde', '#f2992e', '#f3f3ef'];

export function playerColors(playerIds: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    [...playerIds]
      .sort()
      .map((playerId, index) => [playerId, PLAYER_COLORS[index % PLAYER_COLORS.length] as string]),
  );
}

/** Distance from the centre of a hex to each of its corners, in SVG units. */
export const SIZE = 40;
const SQRT3 = Math.sqrt(3);

export interface Point {
  x: number;
  y: number;
}

/** Centre of a pointy-top hex. */
export function hexCentre(hex: Hex): Point {
  return { x: SIZE * SQRT3 * (hex.q + hex.r / 2), y: SIZE * 1.5 * hex.r };
}

/** The outline of a hex, starting from its top corner. */
export function hexPoints(centre: Point, size = SIZE): string {
  return [0, 1, 2, 3, 4, 5]
    .map((corner) => {
      const angle = (Math.PI / 3) * corner - Math.PI / 2;
      const x = centre.x + size * Math.cos(angle);
      const y = centre.y + size * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

/** A corner is the top or the bottom corner of the hex its id names. */
export function vertexPoint(vertex: string): Point {
  const parsed = parseVertexId(vertex);
  if (!parsed) return { x: 0, y: 0 };
  const centre = hexCentre(parsed.hex);
  return { x: centre.x, y: centre.y + (parsed.corner === 'N' ? -SIZE : SIZE) };
}

export function edgePoints(edge: string): [Point, Point] {
  const ends = parseEdgeId(edge);
  if (!ends)
    return [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
  return [vertexPoint(ends[0]), vertexPoint(ends[1])];
}

/** A point part of the way from `from` to `to`. */
export function towards(from: Point, to: Point, share: number): Point {
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
}

/** The box around the island, with room left around it for the ports. */
export function boundsOf(hexes: readonly Hex[], padX: number, padY = padX) {
  const centres = hexes.map(hexCentre);
  const xs = centres.map((centre) => centre.x);
  const ys = centres.map((centre) => centre.y);
  const halfWidth = (SIZE * SQRT3) / 2;
  const minX = Math.min(...xs) - halfWidth - padX;
  const minY = Math.min(...ys) - SIZE - padY;
  return {
    minX,
    minY,
    width: Math.max(...xs) + halfWidth + padX - minX,
    height: Math.max(...ys) + SIZE + padY - minY,
    centre: {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      y: (Math.min(...ys) + Math.max(...ys)) / 2,
    },
  };
}

/**
 * Where a port's marker floats: straight out to sea from the middle of its edge, away from
 * the tile the edge belongs to.
 */
export function portSpot(edge: string, hexes: readonly Hex[], distance: number): Point {
  const [a, b] = edgePoints(edge);
  const middle = towards(a, b, 0.5);
  const land = hexes
    .map(hexCentre)
    .find((centre) => Math.hypot(centre.x - middle.x, centre.y - middle.y) < SIZE);
  if (!land) return middle;
  const reach = Math.hypot(middle.x - land.x, middle.y - land.y);
  return towards(land, middle, 1 + distance / reach);
}

/** How many of the 36 rolls make a number: the dots under it on its token. */
export function pips(number: number): number {
  return 6 - Math.abs(7 - number);
}
