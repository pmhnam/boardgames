export const DEVELOPMENT_CARD_TYPES = [
  'knight',
  'victoryPoint',
  'roadBuilding',
  'invention',
  'monopoly',
] as const;
export type DevelopmentCardType = (typeof DEVELOPMENT_CARD_TYPES)[number];

/** A Victory Point card is never played: it counts from the moment it is bought. */
export type PlayableCardType = Exclude<DevelopmentCardType, 'victoryPoint'>;

export function isDevelopmentCardType(value: unknown): value is DevelopmentCardType {
  return DEVELOPMENT_CARD_TYPES.includes(value as DevelopmentCardType);
}
