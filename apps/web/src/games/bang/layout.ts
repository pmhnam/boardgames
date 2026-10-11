/** Where a seat's middle sits on the table, in percent of its width and height. */
export interface SeatSpot {
  x: number;
  y: number;
}

/** How far the ring of seats reaches from the middle of the table, in percent. */
const REACH_X = 38;
const REACH_Y = 35;

/**
 * Where each seat goes round the table, in seat order. Seats next to each other in the order
 * are next to each other on the ring, which is what distance is counted along. The viewer sits
 * at the bottom and play runs clockwise from there; anyone watching sees the first seat there.
 */
export function seatSpots(count: number, viewerIndex: number): SeatSpot[] {
  const first = viewerIndex >= 0 && viewerIndex < count ? viewerIndex : 0;
  return Array.from({ length: count }, (_, index) => {
    const steps = (index - first + count) % count;
    // Screen angles: a quarter turn is straight down, and they grow clockwise.
    const angle = Math.PI / 2 + (steps * 2 * Math.PI) / count;
    return {
      x: round(50 + REACH_X * Math.cos(angle)),
      y: round(50 + REACH_Y * Math.sin(angle)),
    };
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** How many card backs stand for a hand: enough to tell a full hand from a thin one. */
export const MAX_FAN = 3;

export function fanSize(handCount: number): number {
  return Math.min(MAX_FAN, Math.max(0, handCount));
}
