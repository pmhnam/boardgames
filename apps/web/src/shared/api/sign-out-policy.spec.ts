import { ErrorCodes } from '@bgp/shared-types';
import { describe, expect, it } from 'vitest';
import { shouldSignOut } from './sign-out-policy';

describe('shouldSignOut', () => {
  it('signs out when the server no longer accepts the token that was sent', () => {
    expect(shouldSignOut(ErrorCodes.Unauthorized, 'token', 'token')).toBe(true);
  });

  it('keeps a player signed in when a password they typed was wrong', () => {
    expect(shouldSignOut(ErrorCodes.InvalidCredentials, 'token', 'token')).toBe(false);
  });

  it('keeps the session for refusals that are about permission, not identity', () => {
    for (const code of [
      ErrorCodes.Forbidden,
      ErrorCodes.PasswordRequired,
      ErrorCodes.RateLimited,
    ]) {
      expect(shouldSignOut(code, 'token', 'token')).toBe(false);
    }
  });

  it('ignores an answer about a session that has since been replaced', () => {
    expect(shouldSignOut(ErrorCodes.Unauthorized, 'old', 'new')).toBe(false);
    expect(shouldSignOut(ErrorCodes.Unauthorized, 'old', undefined)).toBe(false);
  });

  it('has nothing to sign out of when no token was sent', () => {
    expect(shouldSignOut(ErrorCodes.Unauthorized, undefined, undefined)).toBe(false);
  });
});
