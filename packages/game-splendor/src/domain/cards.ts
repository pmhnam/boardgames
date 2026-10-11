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

// A match's cards and nobles are a list that never changes, and they are looked up by id for
// every card a player has bought, every time the table is shown to anyone. So each list is
// indexed once, the first time it is asked about, and found again by the list itself.
const indexes = new WeakMap<readonly { id: string }[], Map<string, { id: string }>>();

function findById<T extends { id: string }>(list: readonly T[], id: string): T | undefined {
  let byId = indexes.get(list);
  if (!byId) {
    byId = new Map();
    // The first of a kind wins, as it would when searching the list from its start.
    for (const item of list) if (!byId.has(item.id)) byId.set(item.id, item);
    indexes.set(list, byId);
  }
  return byId.get(id) as T | undefined;
}

export function getCard(cards: readonly DevelopmentCard[], cardId: string): DevelopmentCard {
  const card = findById(cards, cardId);
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  return card;
}

export function getNoble(nobles: readonly Noble[], nobleId: string): Noble {
  const noble = findById(nobles, nobleId);
  if (!noble) throw new Error(`Unknown noble: ${nobleId}`);
  return noble;
}
