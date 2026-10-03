import { createSeededRandom } from '@bgp/game-core';
import type { DevelopmentCard, Noble, Tier } from '../domain/cards.js';

export interface RandomSetup {
  /** Shuffled card ids per tier. Cards are drawn from the end. */
  decks: Record<Tier, string[]>;
  /** The nobles dealt to this match. */
  nobleIds: string[];
  startingPlayerIndex: number;
}

/** All randomness in a match is decided here, up front, from the seed. */
export function randomizeSetup(input: {
  seed: string;
  playerCount: number;
  cards: readonly DevelopmentCard[];
  nobles: readonly Noble[];
  nobleCount: number;
}): RandomSetup {
  const random = createSeededRandom(input.seed);
  const shuffledTier = (tier: Tier) =>
    random.shuffle(input.cards.filter((card) => card.tier === tier).map((card) => card.id));
  return {
    decks: { 1: shuffledTier(1), 2: shuffledTier(2), 3: shuffledTier(3) },
    nobleIds: random.shuffle(input.nobles.map((noble) => noble.id)).slice(0, input.nobleCount),
    startingPlayerIndex: random.int(input.playerCount),
  };
}
