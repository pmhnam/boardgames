/** Machine-readable error codes shared by REST and WebSocket responses. */
export const ErrorCodes = {
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  ValidationFailed: 'VALIDATION_FAILED',
  NotFound: 'NOT_FOUND',
  RateLimited: 'RATE_LIMITED',
  Internal: 'INTERNAL_ERROR',

  InvalidCredentials: 'INVALID_CREDENTIALS',
  PasswordRequired: 'PASSWORD_REQUIRED',
  AccountDisabled: 'ACCOUNT_DISABLED',
  UserNotFound: 'USER_NOT_FOUND',

  UnknownGameType: 'UNKNOWN_GAME_TYPE',
  InvalidGameConfig: 'INVALID_GAME_CONFIG',
  GameConfigConflict: 'GAME_CONFIG_CONFLICT',

  RoomNotFound: 'ROOM_NOT_FOUND',
  RoomFull: 'ROOM_FULL',
  InvalidRoomSettings: 'INVALID_ROOM_SETTINGS',
  BotsNotSupported: 'BOTS_NOT_SUPPORTED',
  RoomNotOpen: 'ROOM_NOT_OPEN',
  RoomInMatch: 'ROOM_IN_MATCH',
  NotRoomMember: 'NOT_ROOM_MEMBER',
  NotRoomHost: 'NOT_ROOM_HOST',
  PlayersNotReady: 'PLAYERS_NOT_READY',
  NotEnoughPlayers: 'NOT_ENOUGH_PLAYERS',

  MatchNotFound: 'MATCH_NOT_FOUND',
  MatchNotPlaying: 'MATCH_NOT_PLAYING',
  MatchNotFinished: 'MATCH_NOT_FINISHED',
  MatchOutdated: 'MATCH_OUTDATED',
  ReplayUnavailable: 'REPLAY_UNAVAILABLE',
  InvalidAction: 'INVALID_ACTION',
  NotYourTurn: 'NOT_YOUR_TURN',
  GameVersionConflict: 'GAME_VERSION_CONFLICT',
  GameControlChanged: 'GAME_CONTROL_CHANGED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export interface ApiErrorBody {
  error: ApiError;
}
