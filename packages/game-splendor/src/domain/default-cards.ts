import type { DevelopmentCard, Tier } from './cards.js';
import type { GemColor } from './gems.js';

/** bonus, tier, points, then the cost in white, blue, green, red, black. */
type CardSpec = [GemColor, Tier, number, number, number, number, number, number];

/** The 90 development cards of the base game, 8 / 6 / 4 per colour in tiers 1 / 2 / 3. */
// prettier-ignore
const SPECS: readonly CardSpec[] = [
  ['white', 1, 0,  0, 3, 0, 0, 0],
  ['white', 1, 1,  0, 0, 4, 0, 0],
  ['white', 1, 0,  0, 0, 0, 2, 1],
  ['white', 1, 0,  0, 2, 0, 0, 2],
  ['white', 1, 0,  3, 1, 0, 0, 1],
  ['white', 1, 0,  0, 2, 2, 0, 1],
  ['white', 1, 0,  0, 1, 1, 1, 1],
  ['white', 1, 0,  0, 1, 2, 1, 1],
  ['white', 2, 2,  0, 0, 0, 5, 0],
  ['white', 2, 3,  6, 0, 0, 0, 0],
  ['white', 2, 2,  0, 0, 0, 5, 3],
  ['white', 2, 2,  0, 0, 1, 4, 2],
  ['white', 2, 1,  0, 0, 3, 2, 2],
  ['white', 2, 1,  2, 3, 0, 3, 0],
  ['white', 3, 4,  0, 0, 0, 0, 7],
  ['white', 3, 4,  3, 0, 0, 3, 6],
  ['white', 3, 3,  0, 3, 3, 5, 3],
  ['white', 3, 5,  3, 0, 0, 0, 7],

  ['blue', 1, 0,  0, 0, 0, 0, 3],
  ['blue', 1, 1,  0, 0, 0, 4, 0],
  ['blue', 1, 0,  1, 0, 0, 0, 2],
  ['blue', 1, 0,  0, 0, 2, 0, 2],
  ['blue', 1, 0,  0, 1, 3, 1, 0],
  ['blue', 1, 0,  1, 0, 2, 2, 0],
  ['blue', 1, 0,  1, 0, 1, 1, 1],
  ['blue', 1, 0,  1, 0, 1, 2, 1],
  ['blue', 2, 2,  0, 5, 0, 0, 0],
  ['blue', 2, 3,  0, 6, 0, 0, 0],
  ['blue', 2, 2,  5, 3, 0, 0, 0],
  ['blue', 2, 2,  2, 0, 0, 1, 4],
  ['blue', 2, 1,  0, 2, 2, 3, 0],
  ['blue', 2, 1,  0, 2, 3, 0, 3],
  ['blue', 3, 4,  7, 0, 0, 0, 0],
  ['blue', 3, 4,  6, 3, 0, 0, 3],
  ['blue', 3, 3,  3, 0, 3, 3, 5],
  ['blue', 3, 5,  7, 3, 0, 0, 0],

  ['green', 1, 0,  0, 0, 0, 3, 0],
  ['green', 1, 1,  0, 0, 0, 0, 4],
  ['green', 1, 0,  2, 1, 0, 0, 0],
  ['green', 1, 0,  0, 2, 0, 2, 0],
  ['green', 1, 0,  1, 3, 1, 0, 0],
  ['green', 1, 0,  0, 1, 0, 2, 2],
  ['green', 1, 0,  1, 1, 0, 1, 1],
  ['green', 1, 0,  1, 1, 0, 1, 2],
  ['green', 2, 2,  0, 0, 5, 0, 0],
  ['green', 2, 3,  0, 0, 6, 0, 0],
  ['green', 2, 2,  0, 5, 3, 0, 0],
  ['green', 2, 2,  4, 2, 0, 0, 1],
  ['green', 2, 1,  2, 3, 0, 0, 2],
  ['green', 2, 1,  3, 0, 2, 3, 0],
  ['green', 3, 4,  0, 7, 0, 0, 0],
  ['green', 3, 4,  3, 6, 3, 0, 0],
  ['green', 3, 3,  5, 3, 0, 3, 3],
  ['green', 3, 5,  0, 7, 3, 0, 0],

  ['red', 1, 0,  3, 0, 0, 0, 0],
  ['red', 1, 1,  4, 0, 0, 0, 0],
  ['red', 1, 0,  0, 2, 1, 0, 0],
  ['red', 1, 0,  2, 0, 0, 2, 0],
  ['red', 1, 0,  1, 0, 0, 1, 3],
  ['red', 1, 0,  2, 0, 1, 0, 2],
  ['red', 1, 0,  1, 1, 1, 0, 1],
  ['red', 1, 0,  2, 1, 1, 0, 1],
  ['red', 2, 2,  0, 0, 0, 0, 5],
  ['red', 2, 3,  0, 0, 0, 6, 0],
  ['red', 2, 2,  3, 0, 0, 0, 5],
  ['red', 2, 2,  1, 4, 2, 0, 0],
  ['red', 2, 1,  2, 0, 0, 2, 3],
  ['red', 2, 1,  0, 3, 0, 2, 3],
  ['red', 3, 4,  0, 0, 7, 0, 0],
  ['red', 3, 4,  0, 3, 6, 3, 0],
  ['red', 3, 3,  3, 5, 3, 0, 3],
  ['red', 3, 5,  0, 0, 7, 3, 0],

  ['black', 1, 0,  0, 0, 3, 0, 0],
  ['black', 1, 1,  0, 4, 0, 0, 0],
  ['black', 1, 0,  0, 0, 2, 1, 0],
  ['black', 1, 0,  2, 0, 2, 0, 0],
  ['black', 1, 0,  0, 0, 1, 3, 1],
  ['black', 1, 0,  2, 2, 0, 1, 0],
  ['black', 1, 0,  1, 1, 1, 1, 0],
  ['black', 1, 0,  1, 2, 1, 1, 0],
  ['black', 2, 2,  5, 0, 0, 0, 0],
  ['black', 2, 3,  0, 0, 0, 0, 6],
  ['black', 2, 2,  0, 0, 5, 3, 0],
  ['black', 2, 2,  0, 1, 4, 2, 0],
  ['black', 2, 1,  3, 2, 2, 0, 0],
  ['black', 2, 1,  3, 0, 3, 0, 2],
  ['black', 3, 4,  0, 0, 0, 7, 0],
  ['black', 3, 4,  0, 0, 3, 6, 3],
  ['black', 3, 3,  3, 3, 5, 3, 0],
  ['black', 3, 5,  0, 0, 0, 7, 3],
];

/** Ids number the cards within their colour and tier: `white-L1-01`, `white-L1-02`… */
function buildCards(specs: readonly CardSpec[]): DevelopmentCard[] {
  const seen = new Map<string, number>();
  return specs.map(([bonus, tier, points, white, blue, green, red, black]) => {
    const group = `${bonus}-L${tier}`;
    const index = (seen.get(group) ?? 0) + 1;
    seen.set(group, index);
    return {
      id: `${group}-${String(index).padStart(2, '0')}`,
      tier,
      bonus,
      points,
      cost: { white, blue, green, red, black },
    };
  });
}

export const DEFAULT_DEVELOPMENT_CARDS: readonly DevelopmentCard[] = buildCards(SPECS);
