import type { GemColor, GemCounts } from './gems.js';

export const TIERS = [1, 2, 3] as const;

export type Tier = (typeof TIERS)[number];

export function isTier(value: unknown): value is Tier {
  return (TIERS as readonly unknown[]).includes(value);
}

export interface DevelopmentCard {
  id: string;
  tier: Tier;
  /** The gem this card is worth, permanently, towards later purchases. */
  bonus: GemColor;
  points: number;
  cost: GemCounts;
}

export interface Noble {
  id: string;
  name: string;
  points: number;
  /** The bonuses (cards, not tokens) a player needs for the noble to visit. */
  requirement: GemCounts;
}

export function getCard(cards: readonly DevelopmentCard[], cardId: string): DevelopmentCard {
  const card = cards.find((candidate) => candidate.id === cardId);
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  return card;
}

export function getNoble(nobles: readonly Noble[], nobleId: string): Noble {
  const noble = nobles.find((candidate) => candidate.id === nobleId);
  if (!noble) throw new Error(`Unknown noble: ${nobleId}`);
  return noble;
}
