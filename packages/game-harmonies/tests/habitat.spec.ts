import { describe, expect, it } from 'vitest';
import type { PlayerBoard } from '../src/domain/board.js';
import { getCard, type AnimalCard } from '../src/domain/cards.js';
import { hexKey } from '../src/domain/hex.js';
import { getCubeTargets, habitatMatchesAt } from '../src/rules/habitat.rules.js';
import { boardWith, cards } from './fixtures/states.js';

const TREE_1 = ['leaf'] as const;
const TREE_2 = ['trunk', 'leaf'] as const;
const TREE_3 = ['trunk', 'trunk', 'leaf'] as const;

function board(stacks: Record<string, readonly string[]>, cubes: string[] = []): PlayerBoard {
  return boardWith(stacks as PlayerBoard['stacks'], { cubes });
}

const at = (q: number, r: number) => ({ q, r });

describe('habitats', () => {
  it('matches a two-cell habitat in each of the six rotations', () => {
    // animal-05: the animal goes on water with a height-1 tree next to it.
    const card = getCard(cards, 'animal-05');
    for (const treeKey of ['3,1', '3,0', '2,0', '1,1', '1,2', '2,2']) {
      expect(habitatMatchesAt(board({ '2,1': ['water'], [treeKey]: TREE_1 }), card, at(2, 1))).toBe(
        true,
      );
    }
  });

  it('needs the animal slot to be the right terrain', () => {
    const card = getCard(cards, 'animal-05');
    expect(habitatMatchesAt(board({ '2,1': ['field'], '3,1': TREE_1 }), card, at(2, 1))).toBe(
      false,
    );
    // The tree is not where the animal goes.
    expect(habitatMatchesAt(board({ '2,1': ['water'], '3,1': TREE_1 }), card, at(3, 1))).toBe(
      false,
    );
  });

  it('needs exact heights, on the slot and around it', () => {
    // animal-18: the animal goes on a height-2 tree next to a height-1 tree.
    const card = getCard(cards, 'animal-18');
    const match = (slot: readonly string[], neighbour: readonly string[]) =>
      habitatMatchesAt(board({ '2,1': slot, '3,1': neighbour }), card, at(2, 1));

    expect(match(TREE_2, TREE_1)).toBe(true);
    expect(match(TREE_1, TREE_1)).toBe(false);
    expect(match(TREE_3, TREE_1)).toBe(false);
    expect(match(TREE_2, TREE_2)).toBe(false);
    expect(match(TREE_2, TREE_3)).toBe(false);
    // An unfinished tree is not a tree at all.
    expect(match(['trunk', 'trunk'], TREE_1)).toBe(false);
  });

  it('needs every cell in its exact place relative to the slot', () => {
    // animal-01: animal on water, then water, then a height-3 tree, in a straight line.
    const card = getCard(cards, 'animal-01');
    const line = board({ '0,1': ['water'], '1,1': ['water'], '2,1': TREE_3 });
    const bent = board({ '0,1': ['water'], '1,1': ['water'], '2,0': TREE_3 });
    const swapped = board({ '0,1': ['water'], '1,1': TREE_3, '2,1': ['water'] });

    expect(habitatMatchesAt(line, card, at(0, 1))).toBe(true);
    // The animal sits at the far end of the line, not in the middle.
    expect(habitatMatchesAt(line, card, at(1, 1))).toBe(false);
    expect(habitatMatchesAt(bent, card, at(0, 1))).toBe(false);
    expect(habitatMatchesAt(swapped, card, at(0, 1))).toBe(false);
  });

  it('needs all of a four-cell habitat', () => {
    // animal-13: animal on a height-2 tree with three fields around one side.
    const card = getCard(cards, 'animal-13');
    const full = { '2,1': TREE_2, '2,2': ['field'], '1,2': ['field'], '1,1': ['field'] };
    expect(habitatMatchesAt(board(full), card, at(2, 1))).toBe(true);
    expect(habitatMatchesAt(board({ ...full, '1,2': ['water'] }), card, at(2, 1))).toBe(false);
    const twoFields = { '2,1': TREE_2, '2,2': ['field'], '1,2': ['field'] };
    expect(habitatMatchesAt(board(twoFields), card, at(2, 1))).toBe(false);
  });

  it('does not accept a mirror image', () => {
    // A handed pattern: from the animal, a field, then a mountain one step clockwise.
    const handed: AnimalCard = {
      id: 'handed',
      pointsByAnimalsPlaced: [0, 1],
      habitat: {
        cells: [
          { q: 0, r: 0, terrain: 'WATER', height: 1, animalSlot: true },
          { q: 1, r: 0, terrain: 'FIELD', height: 1, animalSlot: false },
          { q: 0, r: 1, terrain: 'MOUNTAIN', height: 1, animalSlot: false },
        ],
      },
    };
    const asPrinted = board({ '2,1': ['water'], '3,1': ['field'], '2,2': ['mountain'] });
    const rotated = board({ '2,1': ['water'], '2,2': ['field'], '1,2': ['mountain'] });
    const mirrored = board({ '2,1': ['water'], '3,1': ['mountain'], '2,2': ['field'] });

    expect(habitatMatchesAt(asPrinted, handed, at(2, 1))).toBe(true);
    expect(habitatMatchesAt(rotated, handed, at(2, 1))).toBe(true);
    expect(habitatMatchesAt(mirrored, handed, at(2, 1))).toBe(false);
  });

  it('does not match across the edge of the board', () => {
    expect(
      habitatMatchesAt(board({ '0,0': ['water'] }), getCard(cards, 'animal-05'), at(0, 0)),
    ).toBe(false);
  });

  it('offers only matching, unoccupied slots as cube targets', () => {
    const card = getCard(cards, 'animal-05');
    const stacks = { '2,1': ['water'], '3,1': TREE_1, '2,2': ['water'], '0,0': ['water'] };

    // Both waters next to the tree qualify; the far one does not.
    expect(getCubeTargets(board(stacks), card).map(hexKey).sort()).toEqual(['2,1', '2,2']);
    expect(getCubeTargets(board(stacks, ['2,1']), card).map(hexKey)).toEqual(['2,2']);
  });

  it('every default card is well formed and matches its own habitat as printed', () => {
    const stackFor = (terrain: string, height: number): string[] =>
      ({
        WATER: ['water'],
        FIELD: ['field'],
        TREE: [...Array<string>(height - 1).fill('trunk'), 'leaf'],
        MOUNTAIN: Array<string>(height).fill('mountain'),
        BUILDING: ['mountain', 'building'],
      })[terrain] ?? [];

    expect(cards).toHaveLength(32);
    for (const card of cards) {
      const slots = card.habitat.cells.filter((cell) => cell.animalSlot);
      expect(slots).toHaveLength(1);
      expect(card.pointsByAnimalsPlaced[0]).toBe(0);
      expect(card.name).toBeTruthy();

      const laidOut = board(
        Object.fromEntries(
          card.habitat.cells.map((cell) => [hexKey(cell), stackFor(cell.terrain, cell.height)]),
        ),
      );
      expect(habitatMatchesAt(laidOut, card, slots[0]!), card.id).toBe(true);
    }
    expect(new Set(cards.map((card) => card.name)).size).toBe(32);
  });
});
