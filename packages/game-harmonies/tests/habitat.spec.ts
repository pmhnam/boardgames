import { describe, expect, it } from 'vitest';
import { getCard } from '../src/domain/cards.js';
import { hexKey } from '../src/domain/hex.js';
import { getCubeTargets, habitatMatchesAt } from '../src/rules/habitat.rules.js';
import { boardWith, cards } from './fixtures/states.js';

describe('habitats', () => {
  it('matches a two-cell habitat in any direction', () => {
    const heron = getCard(cards, 'heron');
    // Field on each of the six sides of the water in turn.
    for (const fieldKey of ['3,1', '3,0', '2,0', '1,1', '1,2', '2,2']) {
      const board = boardWith({ '2,1': ['water'], [fieldKey]: ['field'] });
      expect(habitatMatchesAt(board, heron, { q: 2, r: 1 })).toBe(true);
    }
  });

  it('requires the cube terrain itself', () => {
    const board = boardWith({ '2,1': ['field'], '3,1': ['field'] });
    expect(habitatMatchesAt(board, getCard(cards, 'heron'), { q: 2, r: 1 })).toBe(false);
  });

  it('respects exact heights', () => {
    const kingfisher = getCard(cards, 'kingfisher');
    const short = boardWith({ '2,1': ['leaf'], '3,1': ['water'] });
    const right = boardWith({ '2,1': ['trunk', 'leaf'], '3,1': ['water'] });
    const tall = boardWith({ '2,1': ['trunk', 'trunk', 'leaf'], '3,1': ['water'] });
    expect(habitatMatchesAt(short, kingfisher, { q: 2, r: 1 })).toBe(false);
    expect(habitatMatchesAt(right, kingfisher, { q: 2, r: 1 })).toBe(true);
    expect(habitatMatchesAt(tall, kingfisher, { q: 2, r: 1 })).toBe(false);
  });

  it('keeps the shape of a three-cell habitat', () => {
    const otter = getCard(cards, 'otter');
    const line = boardWith({ '2,0': ['water'], '2,1': ['water'], '2,2': ['water'] });
    const bent = boardWith({ '2,0': ['water'], '2,1': ['water'], '3,1': ['water'] });
    expect(habitatMatchesAt(line, otter, { q: 2, r: 1 })).toBe(true);
    // The otter sits in the middle of a straight line of three.
    expect(habitatMatchesAt(line, otter, { q: 2, r: 0 })).toBe(false);
    expect(habitatMatchesAt(bent, otter, { q: 2, r: 1 })).toBe(false);
  });

  it('matches a mirrored habitat', () => {
    const fox = getCard(cards, 'fox');
    const oneWay = boardWith({ '2,1': ['trunk', 'leaf'], '3,1': ['field'], '2,2': ['mountain'] });
    const mirrored = boardWith({ '2,1': ['trunk', 'leaf'], '3,1': ['mountain'], '2,2': ['field'] });
    expect(habitatMatchesAt(oneWay, fox, { q: 2, r: 1 })).toBe(true);
    expect(habitatMatchesAt(mirrored, fox, { q: 2, r: 1 })).toBe(true);
  });

  it('does not match across the edge of the board', () => {
    const board = boardWith({ '0,0': ['water'] });
    expect(habitatMatchesAt(board, getCard(cards, 'heron'), { q: 0, r: 0 })).toBe(false);
  });

  it('offers only free cells as cube targets', () => {
    const stacks = {
      '2,1': ['water' as const],
      '3,1': ['field' as const],
      '2,2': ['water' as const],
    };
    const heron = getCard(cards, 'heron');
    expect(getCubeTargets(boardWith(stacks), heron).map(hexKey).sort()).toEqual(['2,1', '2,2']);
    expect(getCubeTargets(boardWith(stacks, { cubes: ['2,1'] }), heron).map(hexKey)).toEqual([
      '2,2',
    ]);
  });
});
