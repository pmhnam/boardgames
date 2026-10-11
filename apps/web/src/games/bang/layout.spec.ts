import { describe, expect, it } from 'vitest';
import { fanSize, seatSpots } from './layout';

describe('seats round the table', () => {
  it('puts the viewer at the bottom, in the middle', () => {
    for (const count of [4, 5, 6, 7]) {
      for (let viewer = 0; viewer < count; viewer += 1) {
        const spot = seatSpots(count, viewer)[viewer];
        expect(spot?.x).toBe(50);
        expect(spot?.y).toBeGreaterThan(80);
      }
    }
  });

  it('puts the first seat at the bottom for anyone watching', () => {
    const [first] = seatSpots(5, -1);
    expect(first).toEqual(seatSpots(5, 0)[0]);
  });

  it('runs clockwise: the next seat is to the left of the bottom one', () => {
    const spots = seatSpots(4, 0);
    expect(spots[1]?.x).toBeLessThan(50);
    expect(spots[2]?.y).toBeLessThan(50);
    expect(spots[3]?.x).toBeGreaterThan(50);
  });

  it('keeps the ring in seat order whoever is looking', () => {
    const fromFirst = seatSpots(6, 0);
    const fromThird = seatSpots(6, 2);
    // The same ring, turned: seat 2 from its own chair is where seat 0 is from seat 0's.
    for (let index = 0; index < 6; index += 1) {
      expect(fromThird[(index + 2) % 6]).toEqual(fromFirst[index]);
    }
  });

  it('gives every seat its own place, inside the table', () => {
    for (const count of [2, 4, 5, 6, 7, 8]) {
      const spots = seatSpots(count, 0);
      expect(new Set(spots.map((spot) => `${spot.x}:${spot.y}`)).size).toBe(count);
      for (const spot of spots) {
        expect(spot.x).toBeGreaterThanOrEqual(10);
        expect(spot.x).toBeLessThanOrEqual(90);
        expect(spot.y).toBeGreaterThanOrEqual(10);
        expect(spot.y).toBeLessThanOrEqual(90);
      }
    }
  });

  it('mirrors left and right, so the table looks even', () => {
    const spots = seatSpots(7, 0);
    for (let steps = 1; steps < 7; steps += 1) {
      expect(spots[steps]?.x).toBeCloseTo(100 - (spots[7 - steps]?.x ?? 0), 1);
      expect(spots[steps]?.y).toBeCloseTo(spots[7 - steps]?.y ?? 0, 1);
    }
  });
});

describe('a hand seen from behind', () => {
  it('shows a back for each card up to a full fan', () => {
    expect(fanSize(0)).toBe(0);
    expect(fanSize(2)).toBe(2);
    expect(fanSize(3)).toBe(3);
    expect(fanSize(9)).toBe(3);
  });
});
