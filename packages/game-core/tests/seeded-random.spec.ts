import { describe, expect, it } from 'vitest';
import { createSeededRandom } from '../src/index.js';

describe('createSeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createSeededRandom('seed-1');
    const b = createSeededRandom('seed-1');
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next()),
    );
  });

  it('produces different sequences for different seeds', () => {
    expect(createSeededRandom('seed-1').next()).not.toEqual(createSeededRandom('seed-2').next());
  });

  it('keeps int() within range', () => {
    const random = createSeededRandom('range');
    for (let i = 0; i < 500; i++) {
      const value = random.int(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it('shuffles without losing or mutating items', () => {
    const items = [1, 2, 3, 4, 5, 6];
    const shuffled = createSeededRandom('shuffle').shuffle(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...shuffled].sort()).toEqual(items);
  });
});
