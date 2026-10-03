import type { TerrainKind } from './board.js';
import type { Hex } from './hex.js';

export interface TerrainRequirement {
  kind: TerrainKind;
  /** Exact height. Omitted means any height. */
  height?: number;
}

export interface HabitatCell {
  /** Relative to the cube cell, before rotation/mirroring. */
  offset: Hex;
  requires: TerrainRequirement;
}

export interface AnimalCard {
  id: string;
  name: string;
  /** The terrain the animal cube is placed on. */
  cubeOn: TerrainRequirement;
  /** The rest of the habitat, around the cube cell. May be matched in any orientation. */
  habitat: HabitatCell[];
  /** points[n - 1] is the card's score with n cubes placed. Its length is the cube count. */
  points: number[];
}

const E: Hex = { q: 1, r: 0 };
const W: Hex = { q: -1, r: 0 };
/** Adjacent to both the cube cell and E, forming a triangle. */
const SE: Hex = { q: 0, r: 1 };

const EASY = [2, 5, 9, 14];
const MEDIUM = [3, 7, 12, 18];
const HARD_THREE = [4, 9, 15];
const VERY_HARD = [5, 11, 18];

/**
 * The card set a fresh installation starts with: an original set written for this project,
 * standing in for the published game's cards. The cards a match is played with come from its
 * config.
 */
export const DEFAULT_ANIMAL_CARDS: readonly AnimalCard[] = [
  {
    id: 'heron',
    name: 'Heron',
    cubeOn: { kind: 'water' },
    habitat: [{ offset: E, requires: { kind: 'field' } }],
    points: EASY,
  },
  {
    id: 'frog',
    name: 'Frog',
    cubeOn: { kind: 'water' },
    habitat: [{ offset: E, requires: { kind: 'tree', height: 1 } }],
    points: EASY,
  },
  {
    id: 'salamander',
    name: 'Salamander',
    cubeOn: { kind: 'water' },
    habitat: [{ offset: E, requires: { kind: 'mountain', height: 1 } }],
    points: EASY,
  },
  {
    id: 'otter',
    name: 'Otter',
    cubeOn: { kind: 'water' },
    habitat: [
      { offset: E, requires: { kind: 'water' } },
      { offset: W, requires: { kind: 'water' } },
    ],
    points: HARD_THREE,
  },
  {
    id: 'duck',
    name: 'Duck',
    cubeOn: { kind: 'water' },
    habitat: [
      { offset: E, requires: { kind: 'water' } },
      { offset: SE, requires: { kind: 'field' } },
    ],
    points: HARD_THREE,
  },
  {
    id: 'kingfisher',
    name: 'Kingfisher',
    cubeOn: { kind: 'tree', height: 2 },
    habitat: [{ offset: E, requires: { kind: 'water' } }],
    points: MEDIUM,
  },
  {
    id: 'woodpecker',
    name: 'Woodpecker',
    cubeOn: { kind: 'tree', height: 2 },
    habitat: [{ offset: E, requires: { kind: 'tree', height: 2 } }],
    points: HARD_THREE,
  },
  {
    id: 'squirrel',
    name: 'Squirrel',
    cubeOn: { kind: 'tree', height: 3 },
    habitat: [{ offset: E, requires: { kind: 'tree' } }],
    points: VERY_HARD,
  },
  {
    id: 'owl',
    name: 'Owl',
    cubeOn: { kind: 'tree', height: 3 },
    habitat: [{ offset: E, requires: { kind: 'building' } }],
    points: VERY_HARD,
  },
  {
    id: 'boar',
    name: 'Boar',
    cubeOn: { kind: 'tree', height: 1 },
    habitat: [
      { offset: E, requires: { kind: 'tree', height: 1 } },
      { offset: W, requires: { kind: 'field' } },
    ],
    points: HARD_THREE,
  },
  {
    id: 'fox',
    name: 'Fox',
    cubeOn: { kind: 'tree', height: 2 },
    habitat: [
      { offset: E, requires: { kind: 'field' } },
      { offset: SE, requires: { kind: 'mountain' } },
    ],
    points: VERY_HARD,
  },
  {
    id: 'marmot',
    name: 'Marmot',
    cubeOn: { kind: 'mountain', height: 1 },
    habitat: [{ offset: E, requires: { kind: 'field' } }],
    points: EASY,
  },
  {
    id: 'bear',
    name: 'Bear',
    cubeOn: { kind: 'mountain', height: 2 },
    habitat: [{ offset: E, requires: { kind: 'tree', height: 2 } }],
    points: HARD_THREE,
  },
  {
    id: 'lynx',
    name: 'Lynx',
    cubeOn: { kind: 'mountain', height: 2 },
    habitat: [{ offset: E, requires: { kind: 'mountain', height: 2 } }],
    points: HARD_THREE,
  },
  {
    id: 'ibex',
    name: 'Ibex',
    cubeOn: { kind: 'mountain', height: 3 },
    habitat: [{ offset: E, requires: { kind: 'mountain' } }],
    points: VERY_HARD,
  },
  {
    id: 'eagle',
    name: 'Eagle',
    cubeOn: { kind: 'mountain', height: 3 },
    habitat: [{ offset: E, requires: { kind: 'water' } }],
    points: VERY_HARD,
  },
  {
    id: 'bee',
    name: 'Bee',
    cubeOn: { kind: 'field' },
    habitat: [{ offset: E, requires: { kind: 'tree', height: 1 } }],
    points: EASY,
  },
  {
    id: 'deer',
    name: 'Deer',
    cubeOn: { kind: 'field' },
    habitat: [{ offset: E, requires: { kind: 'tree', height: 3 } }],
    points: HARD_THREE,
  },
  {
    id: 'hare',
    name: 'Hare',
    cubeOn: { kind: 'field' },
    habitat: [
      { offset: E, requires: { kind: 'field' } },
      { offset: SE, requires: { kind: 'field' } },
    ],
    points: HARD_THREE,
  },
  {
    id: 'fieldmouse',
    name: 'Field Mouse',
    cubeOn: { kind: 'field' },
    habitat: [{ offset: E, requires: { kind: 'building' } }],
    points: MEDIUM,
  },
  {
    id: 'stork',
    name: 'Stork',
    cubeOn: { kind: 'building' },
    habitat: [{ offset: E, requires: { kind: 'water' } }],
    points: MEDIUM,
  },
  {
    id: 'bat',
    name: 'Bat',
    cubeOn: { kind: 'building' },
    habitat: [{ offset: E, requires: { kind: 'mountain' } }],
    points: MEDIUM,
  },
  {
    id: 'cat',
    name: 'Cat',
    cubeOn: { kind: 'building' },
    habitat: [
      { offset: E, requires: { kind: 'field' } },
      { offset: W, requires: { kind: 'field' } },
    ],
    points: VERY_HARD,
  },
  {
    id: 'swallow',
    name: 'Swallow',
    cubeOn: { kind: 'building' },
    habitat: [{ offset: E, requires: { kind: 'building' } }],
    points: VERY_HARD,
  },
];

export function getCard(cards: readonly AnimalCard[], cardId: string): AnimalCard {
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error(`Unknown animal card: ${cardId}`);
  return card;
}

export function isCardComplete(card: AnimalCard, cubesPlaced: number): boolean {
  return cubesPlaced >= card.points.length;
}
