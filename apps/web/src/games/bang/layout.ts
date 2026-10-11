// Where the seats go is the same question at any round table: see `shared/seats`.
export { seatSpots, type SeatSpot } from '../shared/seats';

/** How many card backs stand for a hand: enough to tell a full hand from a thin one. */
export const MAX_FAN = 3;

export function fanSize(handCount: number): number {
  return Math.min(MAX_FAN, Math.max(0, handCount));
}
