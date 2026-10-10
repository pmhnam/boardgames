import { DEFAULT_HARMONIES_CONFIG, type AnimalCard } from '@bgp/game-harmonies';
import { describe, expect, it } from 'vitest';
import { ICON_PATHS } from './art/icons';
import { animalIcon, backToFront, cardTint, grownCells, hexWall, topGlyph } from './layout';

describe('what a stack shows on top', () => {
  it('shows nothing on an empty cell', () => {
    expect(topGlyph([])).toBeNull();
  });

  it('tells loose leaves from a tree', () => {
    expect(topGlyph(['leaf'])).toBe('leaf');
    expect(topGlyph(['trunk', 'leaf'])).toBe('tree');
    expect(topGlyph(['trunk', 'trunk', 'leaf'])).toBe('tree');
  });

  it('shows a bare trunk as a log', () => {
    expect(topGlyph(['trunk'])).toBe('log');
    expect(topGlyph(['trunk', 'trunk'])).toBe('log');
  });

  it('tells a building from a red token that is not one yet', () => {
    expect(topGlyph(['building'])).toBe('bricks');
    expect(topGlyph(['mountain', 'building'])).toBe('house');
    expect(topGlyph(['trunk', 'building'])).toBe('house');
    expect(topGlyph(['building', 'building'])).toBe('house');
  });

  it('shows a house on a diagram whose lower token is left open', () => {
    expect(topGlyph(['any', 'building'])).toBe('house');
    expect(topGlyph(['any'])).toBeNull();
  });

  it('shows flat terrain and mountains as themselves', () => {
    expect(topGlyph(['water'])).toBe('waves');
    expect(topGlyph(['field'])).toBe('wheat');
    expect(topGlyph(['mountain', 'mountain', 'mountain'])).toBe('peaks');
  });
});

describe('card artwork', () => {
  const cards = DEFAULT_HARMONIES_CONFIG.cards;

  it('gives every card of the printed set its own picture', () => {
    const icons = cards.map(animalIcon);
    expect(icons).not.toContain('paw');
    expect(new Set(icons).size).toBe(cards.length);
    for (const icon of icons) expect(ICON_PATHS[icon]).toBeTruthy();
  });

  it('falls back to a paw print for a card the set does not know', () => {
    const custom: AnimalCard = { ...cards[0]!, id: 'custom', sourceId: undefined };
    expect(animalIcon(custom)).toBe('paw');
    expect(animalIcon({ ...custom, sourceId: 999 })).toBe('paw');
  });

  it('tints a card by the terrain its animal lives on', () => {
    const tintOf = (name: string) => cardTint(cards.find((card) => card.name === name)!);
    // Otter: on water. Bear: on a mountain. Squirrel: on a tree. Cat: on a building.
    expect(tintOf('Rái cá')).toBe('water');
    expect(tintOf('Gấu')).toBe('mountain');
    expect(tintOf('Sóc')).toBe('leaf');
    expect(tintOf('Mèo')).toBe('building');
  });
});

describe('what changed on a board', () => {
  it('finds the cells that gained a token or an animal', () => {
    const before = { stacks: { '0,0': ['trunk' as const], '1,0': ['water' as const] }, cubes: [] };
    const after = {
      stacks: {
        '0,0': ['trunk' as const, 'leaf' as const],
        '1,0': ['water' as const],
        '2,0': ['field' as const],
      },
      cubes: ['1,0'],
    };
    expect(grownCells(before, after).sort()).toEqual(['0,0', '1,0', '2,0']);
  });

  it('reports nothing when the board is unchanged or stepped back', () => {
    const board = { stacks: { '0,0': ['trunk' as const, 'leaf' as const] }, cubes: ['0,0'] };
    expect(grownCells(board, board)).toEqual([]);
    expect(grownCells(board, { stacks: { '0,0': ['trunk' as const] }, cubes: [] })).toEqual([]);
  });
});

describe('drawing', () => {
  it('draws back rows before front ones', () => {
    const cells = [
      { q: 0, r: 2 },
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
    ];
    expect(backToFront(cells, 10)).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 0, r: 2 },
    ]);
  });

  it('closes the side of a token under its lower three edges', () => {
    // Four corners along the top, the same four pulled down, walked back the other way.
    const points = hexWall(0, 0, 10, 4).split(' ');
    expect(points).toHaveLength(8);
    expect(points[0]).toBe('10.0,0.0');
    expect(points[3]).toBe('-10.0,0.0');
    expect(points[4]).toBe('-10.0,4.0');
    expect(points[7]).toBe('10.0,4.0');
  });
});
