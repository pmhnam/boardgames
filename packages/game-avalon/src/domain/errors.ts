import { CommonRuleCodes } from '@bgp/game-core';

export const AvalonRuleCodes = {
  ...CommonRuleCodes,
  WrongPhase: 'WRONG_PHASE',
  InvalidTeam: 'INVALID_TEAM',
  StaleProposal: 'STALE_PROPOSAL',
  AlreadyVoted: 'ALREADY_VOTED',
  StaleQuest: 'STALE_QUEST',
  AlreadyPlayed: 'ALREADY_PLAYED',
  MustPlaySuccess: 'MUST_PLAY_SUCCESS',
  InvalidTarget: 'INVALID_TARGET',
  LadyAlreadyHeld: 'LADY_ALREADY_HELD',
  InvalidPlayerCount: 'INVALID_PLAYER_COUNT',
  RolesDoNotFit: 'ROLES_DO_NOT_FIT',
} as const;
