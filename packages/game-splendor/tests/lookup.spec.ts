import { describe, expect, it } from 'vitest';
import { getCard, getNoble, type DevelopmentCard } from '../src/domain/cards.js';
import { gameConfig } from './fixtures/states.js';

// Cards and nobles are found through an index made once for each list. These hold the index
// to what searching the list from its start would find.

describe('finding a card or a noble by its id', () => {
  it('finds every card and noble of the set', () => {
    for (const card of gameConfig.cards) expect(getCard(gameConfig.cards, card.id)).toBe(card);
    for (const noble of gameConfig.nobles) {
      expect(getNoble(gameConfig.nobles, noble.id)).toBe(noble);
    }
  });

  it('refuses an id that is not in the list', () => {
    expect(() => getCard(gameConfig.cards, 'no-such-card')).toThrow('Unknown card');
    expect(() => getNoble(gameConfig.nobles, 'no-such-noble')).toThrow('Unknown noble');
  });

  it('takes the first of two cards with one id, as a search from the start would', () => {
    const [first, second] = gameConfig.cards as [DevelopmentCard, DevelopmentCard];
    const twice = [first, { ...second, id: first.id }];
    expect(getCard(twice, first.id)).toBe(first);
  });

  it('keeps one list apart from another', () => {
    const [first, second] = gameConfig.cards as [DevelopmentCard, DevelopmentCard];
    expect(getCard([first], first.id)).toBe(first);
    expect(() => getCard([first], second.id)).toThrow('Unknown card');
    expect(getCard([second], second.id)).toBe(second);
  });
});
