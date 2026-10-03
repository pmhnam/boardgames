import { CommonRuleCodes } from '@bgp/game-core';

export const HarmoniesRuleCodes = {
  ...CommonRuleCodes,
  TokensAlreadyTaken: 'TOKENS_ALREADY_TAKEN',
  InvalidSpace: 'INVALID_SPACE',
  SpaceEmpty: 'SPACE_EMPTY',
  TokenNotInHand: 'TOKEN_NOT_IN_HAND',
  InvalidPosition: 'INVALID_POSITION',
  CellHasCube: 'CELL_HAS_CUBE',
  IllegalStack: 'ILLEGAL_STACK',
  CardAlreadyTaken: 'CARD_ALREADY_TAKEN',
  CardNotAvailable: 'CARD_NOT_AVAILABLE',
  TooManyCards: 'TOO_MANY_CARDS',
  CardNotOwned: 'CARD_NOT_OWNED',
  CardCompleted: 'CARD_COMPLETED',
  HabitatNotMatched: 'HABITAT_NOT_MATCHED',
  TokensNotTaken: 'TOKENS_NOT_TAKEN',
  TokensRemaining: 'TOKENS_REMAINING',
} as const;
