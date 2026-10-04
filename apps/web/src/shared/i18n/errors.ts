import { ErrorCodes, type ErrorCode } from '@bgp/shared-types';
import { ApiRequestError } from '../api/http';
import type { Translate } from './useT';
import type { MessageKey } from './vi';

/** Codes with wording of our own. Any other shows the server's message as it came. */
const MESSAGE_FOR_CODE: Partial<Record<ErrorCode, MessageKey>> = {
  [ErrorCodes.Unauthorized]: 'error.unauthorized',
  [ErrorCodes.RateLimited]: 'error.rateLimited',
  [ErrorCodes.Internal]: 'error.internal',
  [ErrorCodes.RoomNotFound]: 'error.roomNotFound',
  [ErrorCodes.RoomFull]: 'error.roomFull',
  [ErrorCodes.RoomNotOpen]: 'error.roomNotOpen',
  [ErrorCodes.InvalidRoomSettings]: 'error.invalidRoomSettings',
  [ErrorCodes.PlayersNotReady]: 'error.playersNotReady',
  [ErrorCodes.NotEnoughPlayers]: 'error.notEnoughPlayers',
  [ErrorCodes.NotRoomHost]: 'error.notRoomHost',
  [ErrorCodes.BotsNotSupported]: 'error.botsNotSupported',
};

/** Codes whose server message says which thing was wrong: it is shown after ours. */
const KEEPS_SERVER_DETAIL: ReadonlySet<ErrorCode> = new Set([ErrorCodes.InvalidRoomSettings]);

/** What to tell the person about a failed request, in their language where we have the words. */
export function errorText(t: Translate, error: unknown): string {
  if (error instanceof ApiRequestError) {
    const code = error.error.code;
    const key = MESSAGE_FOR_CODE[code];
    if (!key) return error.message;
    return KEEPS_SERVER_DETAIL.has(code) ? `${t(key)} ${error.message}` : t(key);
  }
  // fetch rejects with a TypeError when the request never got an answer.
  if (error instanceof TypeError) return t('error.network');
  return error instanceof Error ? error.message : t('error.unknown');
}
