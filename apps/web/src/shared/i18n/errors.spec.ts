import { ErrorCodes, type ApiError, type ErrorCode } from '@bgp/shared-types';
import { describe, expect, it } from 'vitest';
import { ApiRequestError } from '../api/api-request-error';
import { errorText } from './errors';
import type { Translate } from './useT';

// The key stands in for its wording, so a test says which message was picked.
const t: Translate = (key) => key;

const failure = (code: ErrorCode, message = 'from the server'): ApiError => ({ code, message });

describe('errorText', () => {
  it('uses our wording for a code that has some', () => {
    const error = new ApiRequestError(409, failure(ErrorCodes.RoomFull));
    expect(errorText(t, error)).toBe('error.roomFull');
  });

  it('reads an error handed back in a socket ack the same way', () => {
    expect(errorText(t, failure(ErrorCodes.NotYourTurn))).toBe('error.notYourTurn');
    expect(errorText(t, failure(ErrorCodes.GameVersionConflict))).toBe('error.gameVersionConflict');
  });

  it('keeps the server’s detail after ours where it says which thing was wrong', () => {
    expect(errorText(t, failure(ErrorCodes.InvalidAction, 'Not enough gems.'))).toBe(
      'error.invalidAction Not enough gems.',
    );
    const settings = new ApiRequestError(400, failure(ErrorCodes.InvalidRoomSettings, 'Bad map.'));
    expect(errorText(t, settings)).toBe('error.invalidRoomSettings Bad map.');
  });

  it('shows the server’s message for a code it has no wording for', () => {
    const unknown = failure('SOMETHING_NEW' as ErrorCode, 'Said by the server.');
    expect(errorText(t, unknown)).toBe('Said by the server.');
    expect(errorText(t, new ApiRequestError(500, unknown))).toBe('Said by the server.');
  });

  it('calls a request that never got an answer a network problem', () => {
    expect(errorText(t, new TypeError('Failed to fetch'))).toBe('error.network');
  });

  it('falls back to the message of any other error, then to a generic line', () => {
    expect(errorText(t, new Error('Something specific.'))).toBe('Something specific.');
    expect(errorText(t, null)).toBe('error.unknown');
    expect(errorText(t, 'oops')).toBe('error.unknown');
    expect(errorText(t, { code: 42 })).toBe('error.unknown');
  });
});
