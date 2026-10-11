import type { CardView, Suit } from '@bgp/game-bang';

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const FACE_RANK: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank: number): string {
  return FACE_RANK[rank] ?? String(rank);
}

/** A card's suit and rank as printed in its corner, e.g. "Q♥". */
export function pipLabel(card: Pick<CardView, 'suit' | 'rank'>): string {
  return `${rankLabel(card.rank)}${SUIT_SYMBOL[card.suit]}`;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}
