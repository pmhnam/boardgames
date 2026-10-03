import { getCard, getNoble } from '../domain/cards.js';
import type { SplendorSetup } from '../domain/game-config.js';
import { emptyGems, type GemCounts } from '../domain/gems.js';
import type { PlayerState, SplendorState } from '../domain/state.js';

/** One permanent gem per purchased card, in that card's colour. */
export function getBonuses(
  config: Pick<SplendorSetup, 'cards'>,
  purchased: readonly string[],
): GemCounts {
  const bonuses = emptyGems();
  for (const cardId of purchased) bonuses[getCard(config.cards, cardId).bonus] += 1;
  return bonuses;
}

/** Prestige: the points on purchased cards plus those of visiting nobles. */
export function getPoints(
  config: Pick<SplendorSetup, 'cards' | 'nobles'>,
  player: Pick<PlayerState, 'purchased' | 'nobles'>,
): number {
  const fromCards = player.purchased.reduce(
    (sum, cardId) => sum + getCard(config.cards, cardId).points,
    0,
  );
  const fromNobles = player.nobles.reduce(
    (sum, nobleId) => sum + getNoble(config.nobles, nobleId).points,
    0,
  );
  return fromCards + fromNobles;
}

export function calculateScores(
  state: Pick<SplendorState, 'config' | 'players' | 'turnOrder'>,
): Record<string, number> {
  return Object.fromEntries(
    state.turnOrder.map((playerId) => {
      const player = state.players[playerId];
      return [playerId, player ? getPoints(state.config, player) : 0];
    }),
  );
}
