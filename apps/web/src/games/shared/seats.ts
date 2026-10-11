/** Where a seat's middle sits on the table, in percent of its width and height. */
export interface SeatSpot {
  x: number;
  y: number;
}

/** How far the ring of seats reaches from the middle of the table, in percent. */
export interface SeatReach {
  x: number;
  y: number;
}

const DEFAULT_REACH: SeatReach = { x: 38, y: 35 };

/**
 * Where each seat goes round a table, in seat order. Seats next to each other in the order are
 * next to each other on the ring. The viewer sits at the bottom and play runs clockwise from
 * there; anyone watching sees the first seat there.
 */
export function seatSpots(
  count: number,
  viewerIndex: number,
  reach: SeatReach = DEFAULT_REACH,
): SeatSpot[] {
  const first = viewerIndex >= 0 && viewerIndex < count ? viewerIndex : 0;
  return Array.from({ length: count }, (_, index) => {
    const steps = (index - first + count) % count;
    // Screen angles: a quarter turn is straight down, and they grow clockwise.
    const angle = Math.PI / 2 + (steps * 2 * Math.PI) / count;
    return {
      x: round(50 + reach.x * Math.cos(angle)),
      y: round(50 + reach.y * Math.sin(angle)),
    };
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
