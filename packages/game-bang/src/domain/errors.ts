import { CommonRuleCodes } from '@bgp/game-core';

export const BangRuleCodes = {
  ...CommonRuleCodes,
  /** The action is not the kind the match is waiting on from this player. */
  WrongAction: 'WRONG_ACTION',
  InvalidPlayerCount: 'INVALID_PLAYER_COUNT',
  CardNotInHand: 'CARD_NOT_IN_HAND',
  /** The card cannot be played, or cannot answer what is being asked. */
  CardNotPlayable: 'CARD_NOT_PLAYABLE',
  BangLimit: 'BANG_LIMIT',
  AlreadyInPlay: 'ALREADY_IN_PLAY',
  /** A beer that would heal nobody. */
  NoEffect: 'NO_EFFECT',
  InvalidTarget: 'INVALID_TARGET',
  OutOfRange: 'OUT_OF_RANGE',
  /** The cards named for a discard or a pick are not the ones, or not as many as, asked for. */
  InvalidCards: 'INVALID_CARDS',
  AbilityNotAvailable: 'ABILITY_NOT_AVAILABLE',
} as const;
