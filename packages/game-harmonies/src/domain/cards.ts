import type { TerrainKind } from './board.js';
import { HEX_ROTATIONS, type Hex } from './hex.js';

export const CARD_TERRAINS = ['WATER', 'FIELD', 'TREE', 'MOUNTAIN', 'BUILDING'] as const;

export type CardTerrain = (typeof CARD_TERRAINS)[number];

export const TERRAIN_KIND_OF: Readonly<Record<CardTerrain, TerrainKind>> = {
  WATER: 'water',
  FIELD: 'field',
  TREE: 'tree',
  MOUNTAIN: 'mountain',
  BUILDING: 'building',
};

/** One cell of a habitat, in axial coordinates relative to the card's own origin. */
export interface HabitatCell {
  q: number;
  r: number;
  terrain: CardTerrain;
  /** Exact height of the stack: a height-2 tree does not stand in for a height-3 one. */
  height: number;
  /** True for the one cell the animal cube is placed on. */
  animalSlot: boolean;
}

export interface AnimalCard {
  id: string;
  /** The card's number in the printed set, when it has one. */
  sourceId?: number;
  /** Display name. */
  name?: string;
  /** Index = animals placed from this card, value = the card's score. Entry 0 is "none yet". */
  pointsByAnimalsPlaced: number[];
  habitat: { cells: HabitatCell[] };
}

export function getCard(cards: readonly AnimalCard[], cardId: string): AnimalCard {
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error(`Unknown animal card: ${cardId}`);
  return card;
}

/** How many animal cubes the card comes with. */
export function getCubeCount(card: AnimalCard): number {
  return card.pointsByAnimalsPlaced.length - 1;
}

export function isCardComplete(card: AnimalCard, cubesPlaced: number): boolean {
  return cubesPlaced >= getCubeCount(card);
}

export function getCardPoints(card: AnimalCard, cubesPlaced: number): number {
  return card.pointsByAnimalsPlaced[cubesPlaced] ?? 0;
}

export function getAnimalSlot(card: AnimalCard): HabitatCell {
  const slot = card.habitat.cells.find((cell) => cell.animalSlot);
  if (!slot) throw new Error(`Card ${card.id} has no animal slot`);
  return slot;
}

/** A habitat laid out for matching: its slot, and where its other cells lie in each rotation. */
export interface HabitatShape {
  slot: HabitatCell;
  /** Every cell but the slot. */
  others: readonly HabitatCell[];
  /**
   * One entry for each of the six rotations: how far each of `others`, in the same order, lies
   * from the slot.
   */
  rotations: ReadonlyArray<readonly Hex[]>;
}

// Worked out once for a card and kept for as long as the card is: looking for a habitat asks
// for it at every cell of every board that is considered.
const SHAPES = new WeakMap<AnimalCard, HabitatShape>();

export function getHabitatShape(card: AnimalCard): HabitatShape {
  const known = SHAPES.get(card);
  if (known) return known;
  const slot = getAnimalSlot(card);
  const others = card.habitat.cells.filter((cell) => !cell.animalSlot);
  const shape: HabitatShape = {
    slot,
    others,
    rotations: HEX_ROTATIONS.map((rotate) =>
      others.map((part) => rotate({ q: part.q - slot.q, r: part.r - slot.r })),
    ),
  };
  SHAPES.set(card, shape);
  return shape;
}
