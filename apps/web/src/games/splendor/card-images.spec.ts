import { DEFAULT_SPLENDOR_CONFIG } from '@bgp/game-splendor';
import { describe, expect, it } from 'vitest';
import {
  CARD_IMAGE_PATHS,
  NOBLE_IMAGE_PATHS,
  cardBackImageUrl,
  cardImageUrl,
  nobleImageUrl,
} from './card-images';

describe('Splendor artwork', () => {
  it('maps every base card and noble to a different crop of the correct tier', () => {
    const cards = DEFAULT_SPLENDOR_CONFIG.cards;
    const nobles = DEFAULT_SPLENDOR_CONFIG.nobles;
    expect(Object.keys(CARD_IMAGE_PATHS)).toHaveLength(90);
    expect(new Set(Object.values(CARD_IMAGE_PATHS)).size).toBe(90);
    expect(Object.keys(NOBLE_IMAGE_PATHS)).toHaveLength(10);
    expect(new Set(Object.values(NOBLE_IMAGE_PATHS)).size).toBe(10);

    for (const card of cards) {
      expect(CARD_IMAGE_PATHS[card.id]).toMatch(
        new RegExp(`^development/level-${card.tier}/L${card.tier}-R\\d{2}-C\\d{2}\\.png$`),
      );
      expect(cardImageUrl(card)).toContain(CARD_IMAGE_PATHS[card.id]);
    }
    for (const noble of nobles) expect(nobleImageUrl(noble)).toContain(NOBLE_IMAGE_PATHS[noble.id]);
    for (const tier of [1, 2, 3] as const) {
      expect(cardBackImageUrl(tier)).toContain(`backs/level-${tier}-back.png`);
    }
  });

  it('matches the printed bonus, points and cost on the source sheet', () => {
    expect(CARD_IMAGE_PATHS['red-L1-01']).toBe('development/level-1/L1-R01-C01.png');
    expect(CARD_IMAGE_PATHS['white-L1-07']).toBe('development/level-1/L1-R01-C04.png');
    // The two higher tiers have repeated artwork with different printed gem costs.
    expect(CARD_IMAGE_PATHS['red-L2-03']).toBe('development/level-2/L2-R01-C01.png');
    expect(CARD_IMAGE_PATHS['red-L2-04']).toBe('development/level-2/L2-R03-C06.png');
    expect(CARD_IMAGE_PATHS['blue-L2-02']).toBe('development/level-2/L2-R01-C02.png');
    expect(CARD_IMAGE_PATHS['black-L2-01']).toBe('development/level-2/L2-R03-C01.png');
    expect(CARD_IMAGE_PATHS['white-L3-01']).toBe('development/level-3/L3-R01-C07.png');
    expect(CARD_IMAGE_PATHS['black-L3-01']).toBe('development/level-3/L3-R01-C01.png');
    expect(CARD_IMAGE_PATHS['black-L3-02']).toBe('development/level-3/L3-R01-C06.png');
    expect(CARD_IMAGE_PATHS['red-L3-03']).toBe('development/level-3/L3-R02-C08.png');
    expect(NOBLE_IMAGE_PATHS['noble-henry-viii']).toBe('nobles/NOBLE-02.png');
  });

  it('falls back to the rendered card when a custom game changes its printed values', () => {
    const card = DEFAULT_SPLENDOR_CONFIG.cards[0]!;
    const noble = DEFAULT_SPLENDOR_CONFIG.nobles[0]!;
    expect(
      cardImageUrl({ ...card, cost: { ...card.cost, blue: card.cost.blue + 1 } }),
    ).toBeUndefined();
    expect(
      nobleImageUrl({ ...noble, requirement: { ...noble.requirement, green: 4 } }),
    ).toBeUndefined();
  });
});
