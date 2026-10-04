import type { Card, CardKind, Suit } from './cards.js';

const J = 11;
const Q = 12;
const K = 13;
const A = 14;

function of(kind: CardKind, suit: Suit, ranks: number[]): Card[] {
  return ranks.map((rank) => ({ kind, suit, rank }));
}

/** The 80 playing cards of the base game. */
export const DEFAULT_CARDS: Card[] = [
  ...of('bang', 'spades', [A]),
  ...of('bang', 'diamonds', [2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A]),
  ...of('bang', 'clubs', [2, 3, 4, 5, 6, 7, 8, 9]),
  ...of('bang', 'hearts', [Q, K, A]),
  ...of('missed', 'clubs', [10, J, Q, K, A]),
  ...of('missed', 'spades', [2, 3, 4, 5, 6, 7, 8]),
  ...of('beer', 'hearts', [6, 7, 8, 9, 10, J]),
  ...of('saloon', 'hearts', [5]),
  ...of('stagecoach', 'spades', [9, 9]),
  ...of('wellsFargo', 'hearts', [3]),
  ...of('generalStore', 'clubs', [9]),
  ...of('generalStore', 'spades', [Q]),
  ...of('panic', 'hearts', [J, Q, A]),
  ...of('panic', 'diamonds', [8]),
  ...of('catBalou', 'hearts', [K]),
  ...of('catBalou', 'diamonds', [9, 10, J]),
  ...of('duel', 'diamonds', [Q]),
  ...of('duel', 'spades', [J]),
  ...of('duel', 'clubs', [8]),
  ...of('gatling', 'hearts', [10]),
  ...of('indians', 'diamonds', [K, A]),
  ...of('barrel', 'spades', [Q, K]),
  ...of('scope', 'spades', [A]),
  ...of('mustang', 'hearts', [8, 9]),
  ...of('jail', 'spades', [10, J]),
  ...of('jail', 'hearts', [4]),
  ...of('dynamite', 'hearts', [2]),
  ...of('volcanic', 'spades', [10]),
  ...of('volcanic', 'clubs', [10]),
  ...of('schofield', 'clubs', [J, Q]),
  ...of('schofield', 'spades', [K]),
  ...of('remington', 'clubs', [K]),
  ...of('revCarabine', 'clubs', [A]),
  ...of('winchester', 'spades', [8]),
];
