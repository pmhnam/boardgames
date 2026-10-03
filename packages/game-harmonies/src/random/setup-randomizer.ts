import { createSeededRandom } from '@bgp/game-core';
import type { HarmoniesConfig } from '../domain/game-config.js';
import { TOKEN_COLORS, type TokenColor } from '../domain/tokens.js';

export interface RandomSetup {
  pouch: TokenColor[];
  cardDeck: string[];
  startingPlayerIndex: number;
}

/** All randomness in a match is decided here, up front, from the seed. */
export function randomizeSetup(input: {
  seed: string;
  playerCount: number;
  config: Pick<HarmoniesConfig, 'tokenCounts' | 'cards'>;
}): RandomSetup {
  const random = createSeededRandom(input.seed);
  const allTokens = TOKEN_COLORS.flatMap((color) =>
    Array.from({ length: input.config.tokenCounts[color] }, () => color),
  );
  return {
    pouch: random.shuffle(allTokens),
    cardDeck: random.shuffle(input.config.cards.map((card) => card.id)),
    startingPlayerIndex: random.int(input.playerCount),
  };
}
