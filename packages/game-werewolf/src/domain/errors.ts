import { CommonRuleCodes } from '@bgp/game-core';

export const WerewolfRuleCodes = {
  ...CommonRuleCodes,
  WrongAction: 'WRONG_ACTION',
  InvalidTarget: 'INVALID_TARGET',
  HealNotAvailable: 'HEAL_NOT_AVAILABLE',
  PoisonNotAvailable: 'POISON_NOT_AVAILABLE',
  SkipNotAllowed: 'SKIP_NOT_ALLOWED',
} as const;

/** Why a cast of roles cannot be played at a given table size. */
export const CompositionCodes = {
  InvalidPlayerCount: 'INVALID_PLAYER_COUNT',
  RoleDisabled: 'ROLE_DISABLED',
  RoleOverLimit: 'ROLE_OVER_LIMIT',
  NoWerewolf: 'NO_WEREWOLF',
  TooManyRoles: 'TOO_MANY_ROLES',
  TooManyWerewolves: 'TOO_MANY_WEREWOLVES',
} as const;
export type CompositionCode = (typeof CompositionCodes)[keyof typeof CompositionCodes];
