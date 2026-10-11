import { describe, expect, it } from 'vitest';
import { seatSpots } from './seats';

describe('seats round a table', () => {
  it('reaches as far from the middle as it is told to', () => {
    const [bottom, , top] = seatSpots(4, 0, { x: 40, y: 30 });
    expect(bottom).toEqual({ x: 50, y: 80 });
    expect(top).toEqual({ x: 50, y: 20 });
    expect(seatSpots(4, 0, { x: 40, y: 30 })[1]).toEqual({ x: 10, y: 50 });
  });

  it('seats ten without two in one place', () => {
    const spots = seatSpots(10, 3, { x: 41, y: 38 });
    expect(new Set(spots.map((spot) => `${spot.x}:${spot.y}`)).size).toBe(10);
    expect(spots[3]).toEqual({ x: 50, y: 88 });
  });
});
