import type { Noble } from '../domain/cards.js';
import { GEM_COLORS, type GemCounts } from '../domain/gems.js';

/** The nobles whose requirement a player's bonuses meet. Tokens never count. */
export function getEligibleNobles(nobles: readonly Noble[], bonuses: Readonly<GemCounts>): Noble[] {
  return nobles.filter((noble) =>
    GEM_COLORS.every((color) => bonuses[color] >= noble.requirement[color]),
  );
}
