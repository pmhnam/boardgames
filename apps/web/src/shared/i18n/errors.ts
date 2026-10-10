import { ErrorCodes, type ApiError, type ErrorCode } from '@bgp/shared-types';
import { ApiRequestError } from '../api/api-request-error';
import type { Translate } from './useT';
import type { MessageKey } from './vi';

/** Codes with wording of our own. Any other shows the server's message as it came. */
const MESSAGE_FOR_CODE: Partial<Record<ErrorCode, MessageKey>> = {
  [ErrorCodes.Unauthorized]: 'error.unauthorized',
  [ErrorCodes.RateLimited]: 'error.rateLimited',
  [ErrorCodes.Internal]: 'error.internal',
  [ErrorCodes.Forbidden]: 'error.forbidden',
  [ErrorCodes.ValidationFailed]: 'error.validationFailed',
  [ErrorCodes.NotFound]: 'error.notFound',
  [ErrorCodes.InvalidCredentials]: 'error.invalidCredentials',
  [ErrorCodes.PasswordRequired]: 'error.passwordRequired',
  [ErrorCodes.AccountDisabled]: 'error.accountDisabled',
  [ErrorCodes.UserNotFound]: 'error.userNotFound',
  [ErrorCodes.UnknownGameType]: 'error.unknownGameType',
  [ErrorCodes.InvalidGameConfig]: 'error.invalidGameConfig',
  [ErrorCodes.GameConfigConflict]: 'error.gameConfigConflict',
  [ErrorCodes.RoomNotFound]: 'error.roomNotFound',
  [ErrorCodes.RoomFull]: 'error.roomFull',
  [ErrorCodes.RoomNotOpen]: 'error.roomNotOpen',
  [ErrorCodes.RoomInMatch]: 'error.roomInMatch',
  [ErrorCodes.NotRoomMember]: 'error.notRoomMember',
  [ErrorCodes.MatchNotFound]: 'error.matchNotFound',
  [ErrorCodes.MatchNotPlaying]: 'error.matchNotPlaying',
  [ErrorCodes.MatchNotFinished]: 'error.matchNotFinished',
  [ErrorCodes.MatchOutdated]: 'error.matchOutdated',
  [ErrorCodes.ReplayUnavailable]: 'error.replayUnavailable',
  [ErrorCodes.InvalidAction]: 'error.invalidAction',
  [ErrorCodes.NotYourTurn]: 'error.notYourTurn',
  [ErrorCodes.GameVersionConflict]: 'error.gameVersionConflict',
  [ErrorCodes.GameControlChanged]: 'error.gameControlChanged',
  [ErrorCodes.InvalidRoomSettings]: 'error.invalidRoomSettings',
  [ErrorCodes.PlayersNotReady]: 'error.playersNotReady',
  [ErrorCodes.NotEnoughPlayers]: 'error.notEnoughPlayers',
  [ErrorCodes.NotRoomHost]: 'error.notRoomHost',
  [ErrorCodes.BotsNotSupported]: 'error.botsNotSupported',
};

/** Codes whose server message says which thing was wrong: it is shown after ours. */
const KEEPS_SERVER_DETAIL: ReadonlySet<ErrorCode> = new Set([
  ErrorCodes.InvalidRoomSettings,
  ErrorCodes.InvalidGameConfig,
  // Which rule the move broke.
  ErrorCodes.InvalidAction,
]);

/** An error as the server sends it: thrown by a request, or handed back in a socket ack. */
function apiError(error: unknown): ApiError | null {
  if (error instanceof ApiRequestError) return error.error;
  if (typeof error !== 'object' || error === null) return null;
  const { code, message } = error as Partial<ApiError>;
  return typeof code === 'string' && typeof message === 'string' ? (error as ApiError) : null;
}

/** What to tell the person about a failed request, in their language where we have the words. */
export function errorText(t: Translate, error: unknown): string {
  const failure = apiError(error);
  if (failure) {
    const key = MESSAGE_FOR_CODE[failure.code];
    if (!key) return failure.message;
    return KEEPS_SERVER_DETAIL.has(failure.code) ? `${t(key)} ${failure.message}` : t(key);
  }
  // fetch rejects with a TypeError when the request never got an answer.
  if (error instanceof TypeError) return t('error.network');
  return error instanceof Error ? error.message : t('error.unknown');
}
