export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export const CARD_KINDS = [
  // Brown: played, resolved and discarded.
  'bang',
  'missed',
  'beer',
  'saloon',
  'stagecoach',
  'wellsFargo',
  'generalStore',
  'panic',
  'catBalou',
  'duel',
  'gatling',
  'indians',
  // Blue: stay on the table in front of a player.
  'barrel',
  'scope',
  'mustang',
  'jail',
  'dynamite',
  // Blue weapons: a player holds one at a time.
  'volcanic',
  'schofield',
  'remington',
  'revCarabine',
  'winchester',
] as const;
export type CardKind = (typeof CARD_KINDS)[number];

/** Jack, queen, king and ace count 11 to 14. */
export const MIN_RANK = 2;
export const MAX_RANK = 14;

export interface Card {
  kind: CardKind;
  /** Suit and rank only matter when the card is flipped for a "draw!". */
  suit: Suit;
  rank: number;
}

/** How far a BANG! reaches with each weapon. */
const WEAPON_RANGE: Partial<Record<CardKind, number>> = {
  volcanic: 1,
  schofield: 2,
  remington: 3,
  revCarabine: 4,
  winchester: 5,
};

/** The Colt .45 everyone starts with. */
export const DEFAULT_RANGE = 1;

const BLUE_KINDS: readonly CardKind[] = ['barrel', 'scope', 'mustang', 'jail', 'dynamite'];

export function getWeaponRangeOf(kind: CardKind): number | undefined {
  return WEAPON_RANGE[kind];
}

export function isWeapon(kind: CardKind): boolean {
  return WEAPON_RANGE[kind] !== undefined;
}

/** Whether a card stays on the table once played. */
export function isBlue(kind: CardKind): boolean {
  return isWeapon(kind) || BLUE_KINDS.includes(kind);
}

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

/** What a "draw!" must not show for a dynamite to pass on quietly: spades, 2 to 9. */
export function setsOffDynamite(card: Card): boolean {
  return card.suit === 'spades' && card.rank >= 2 && card.rank <= 9;
}
