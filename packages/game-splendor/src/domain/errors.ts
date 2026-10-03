import { CommonRuleCodes } from '@bgp/game-core';

export const SplendorRuleCodes = {
  ...CommonRuleCodes,
  WrongStep: 'WRONG_STEP',
  InvalidGemSelection: 'INVALID_GEM_SELECTION',
  GemsNotAvailable: 'GEMS_NOT_AVAILABLE',
  DoubleNeedsFour: 'DOUBLE_NEEDS_FOUR',
  ReserveLimitReached: 'RESERVE_LIMIT_REACHED',
  CardNotAvailable: 'CARD_NOT_AVAILABLE',
  DeckEmpty: 'DECK_EMPTY',
  CannotAfford: 'CANNOT_AFFORD',
  InvalidReturn: 'INVALID_RETURN',
  NobleNotEligible: 'NOBLE_NOT_ELIGIBLE',
  PassNotAllowed: 'PASS_NOT_ALLOWED',
} as const;
