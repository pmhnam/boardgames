/** Machine-readable error codes shared by REST and WebSocket responses. */
export const ErrorCodes = {
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  ValidationFailed: 'VALIDATION_FAILED',
  NotFound: 'NOT_FOUND',
  RateLimited: 'RATE_LIMITED',
  Internal: 'INTERNAL_ERROR',

  UnknownGameType: 'UNKNOWN_GAME_TYPE',
  InvalidGameConfig: 'INVALID_GAME_CONFIG',
  GameConfigConflict: 'GAME_CONFIG_CONFLICT',

  RoomNotFound: 'ROOM_NOT_FOUND',
  RoomFull: 'ROOM_FULL',
  RoomNotOpen: 'ROOM_NOT_OPEN',
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
