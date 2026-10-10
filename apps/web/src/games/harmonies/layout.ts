import {
  classifyStack,
  hexKey,
  type AnimalCard,
  type Hex,
  type PlayerBoardView,
  type TokenColor,
} from '@bgp/game-harmonies';
import type { IconName } from './art/icons';

/** The face of each token. The board is a painted table and keeps these in both themes. */
export const TOKEN_FILL: Record<TokenColor, string> = {
  water: '#4fa8e0',
  mountain: '#a3a9b3',
  trunk: '#9a6a3f',
  leaf: '#5dbb63',
  field: '#f5ce4e',
  building: '#e2695c',
};

/** The edge of each token: its face in shadow. */
export const TOKEN_SHADE: Record<TokenColor, string> = {
  water: '#2c73ad',
  mountain: '#6c7380',
  trunk: '#664022',
  leaf: '#34803c',
  field: '#c2931a',
  building: '#a83c33',
};

/** What is printed on each face. */
export const TOKEN_INK: Record<TokenColor, string> = {
  water: '#f2faff',
  mountain: '#f7f8fa',
  trunk: '#f8e6cf',
  leaf: '#f0fcea',
  field: '#7a5608',
  building: '#fff2ec',
};

const TOKEN_GLYPH: Record<TokenColor, IconName> = {
  water: 'waves',
  mountain: 'peaks',
  trunk: 'log',
  leaf: 'leaf',
  field: 'wheat',
  building: 'bricks',
};

/** A token in a diagram; `any` stands for one whose colour does not matter. */
export type DiagramToken = TokenColor | 'any';

/**
 * What to print on the top of a stack. It follows what the stack counts as, so a tree reads
 * differently from loose leaves and a building from a red token that is not one yet. What
 * counts as what is the engine's call, never decided here.
 */
export function topGlyph(stack: readonly DiagramToken[]): IconName | null {
  const top = stack.at(-1);
  if (top === undefined || top === 'any') return null;
  if (stack.includes('any')) return top === 'building' ? 'house' : TOKEN_GLYPH[top];
  const terrain = classifyStack(stack as TokenColor[]);
  if (terrain?.kind === 'building') return 'house';
  if (terrain?.kind === 'tree' && terrain.height > 1) return 'tree';
  return TOKEN_GLYPH[top];
}

/** The picture for each card of the printed set, by its number there. */
const ANIMAL_ICON: Readonly<Record<number, IconName>> = {
  1: 'otter',
  2: 'salmon',
  3: 'salamander',
  4: 'frog',
  5: 'duck',
  6: 'swan',
  7: 'flamingo',
  8: 'mouse',
  9: 'cat',
  10: 'stork',
  11: 'owl',
  12: 'bat',
  13: 'sparrow',
  14: 'squirrel',
  15: 'crow',
  16: 'kingfisher',
  17: 'warbler',
  18: 'monkey',
  19: 'parrot',
  20: 'heron',
  21: 'beaver',
  22: 'bear',
  23: 'goat',
  24: 'seal',
  25: 'eagle',
  26: 'wolf',
  27: 'rooster',
  28: 'horse',
  29: 'deer',
  30: 'buffalo',
  31: 'rabbit',
  32: 'boar',
};

/** A card added through the stored config has no picture of its own and gets a paw print. */
export function animalIcon(card: AnimalCard): IconName {
  return (card.sourceId !== undefined && ANIMAL_ICON[card.sourceId]) || 'paw';
}

const CARD_TINT: Record<AnimalCard['habitat']['cells'][number]['terrain'], TokenColor> = {
  WATER: 'water',
  FIELD: 'field',
  TREE: 'leaf',
  MOUNTAIN: 'mountain',
  BUILDING: 'building',
};

/** A card takes the colour of the terrain its animal lives on. */
export function cardTint(card: AnimalCard): TokenColor {
  const slot = card.habitat.cells.find((cell) => cell.animalSlot) ?? card.habitat.cells[0];
  return slot ? CARD_TINT[slot.terrain] : 'leaf';
}

const SQRT3 = Math.sqrt(3);

/** Centre of a flat-top hex in pixels. */
export function hexCentre(hex: Hex, size: number): { x: number; y: number } {
  return { x: size * 1.5 * hex.q, y: size * SQRT3 * (hex.r + hex.q / 2) };
}

function corner(cx: number, cy: number, size: number, index: number): string {
  const angle = (Math.PI / 3) * index;
  return `${(cx + size * Math.cos(angle)).toFixed(1)},${(cy + size * Math.sin(angle)).toFixed(1)}`;
}

export function hexPoints(cx: number, cy: number, size: number): string {
  return [0, 1, 2, 3, 4, 5].map((index) => corner(cx, cy, size, index)).join(' ');
}

/**
 * The side of a token seen from the front: the lower three edges of a hex, pulled down by the
 * token's thickness. `from` and `to` pick the edges, so one face can be shaded on its own.
 */
export function hexWall(
  cx: number,
  cy: number,
  size: number,
  thickness: number,
  from = 0,
  to = 3,
): string {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let index = from; index <= to; index += 1) {
    top.push(corner(cx, cy, size, index));
    bottom.unshift(corner(cx, cy + thickness, size, index));
  }
  return [...top, ...bottom].join(' ');
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

/** The cells that gained a token or an animal between two views of the same board. */
export function grownCells(
  before: Pick<PlayerBoardView, 'stacks' | 'cubes'>,
  after: Pick<PlayerBoardView, 'stacks' | 'cubes'>,
): string[] {
  const grown = Object.entries(after.stacks)
    .filter(([key, stack]) => stack.length > (before.stacks[key]?.length ?? 0))
    .map(([key]) => key);
  const animals = after.cubes.filter((key) => !before.cubes.includes(key));
  return [...new Set([...grown, ...animals])];
}

/** Back rows first, so taller stacks in front overlap the ones behind. */
export function backToFront<T extends Hex>(cells: readonly T[], size: number): T[] {
  return [...cells].sort(
    (a, b) => hexCentre(a, size).y - hexCentre(b, size).y || hexKey(a).localeCompare(hexKey(b)),
  );
}
