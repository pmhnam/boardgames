import type { CardTerrain, Hex, TokenColor } from '@bgp/game-harmonies';

export const TOKEN_FILL: Record<TokenColor, string> = {
  water: '#4a90d9',
  mountain: '#8c9097',
  trunk: '#8b5a2b',
  leaf: '#4caf50',
  field: '#f2c94c',
  building: '#d9534f',
};

export const TOKEN_LABEL: Record<TokenColor, string> = {
  water: 'Water',
  mountain: 'Mountain',
  trunk: 'Trunk',
  leaf: 'Leaves',
  field: 'Field',
  building: 'Building',
};

export const CARD_TERRAIN_FILL: Record<CardTerrain, string> = {
  WATER: TOKEN_FILL.water,
  FIELD: TOKEN_FILL.field,
  MOUNTAIN: TOKEN_FILL.mountain,
  TREE: TOKEN_FILL.leaf,
  BUILDING: TOKEN_FILL.building,
};

export const CARD_TERRAIN_LABEL: Record<CardTerrain, string> = {
  WATER: 'water',
  FIELD: 'field',
  MOUNTAIN: 'mountain height',
  TREE: 'tree height',
  BUILDING: 'building',
};

const SQRT3 = Math.sqrt(3);

/** Centre of a flat-top hex in pixels. */
export function hexCentre(hex: Hex, size: number): { x: number; y: number } {
  return { x: size * 1.5 * hex.q, y: size * SQRT3 * (hex.r + hex.q / 2) };
}

export function hexPoints(cx: number, cy: number, size: number): string {
  return [0, 1, 2, 3, 4, 5]
    .map((corner) => {
      const angle = (Math.PI / 3) * corner;
      return `${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`;
    })
    .join(' ');
}

export function boundsOf(hexes: Hex[], size: number, padding: number) {
  const centres = hexes.map((hex) => hexCentre(hex, size));
  const xs = centres.map((centre) => centre.x);
  const ys = centres.map((centre) => centre.y);
  const minX = Math.min(...xs) - size - padding;
  const minY = Math.min(...ys) - size - padding;
  return {
    minX,
    minY,
    width: Math.max(...xs) + size + padding - minX,
    height: Math.max(...ys) + size + padding - minY,
  };
}
