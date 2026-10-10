import { ErrorCodes } from '@bgp/shared-types';

/**
 * Whether a failed request means the stored session is dead. Decided by the error's code, not
 * its HTTP status: a wrong password is also a 401, and must not sign a player out.
 */
export function shouldSignOut(
  code: string,
  sentToken: string | undefined,
  currentToken: string | undefined,
): boolean {
  // If the session changed while the request was in flight, the answer is about the old one.
  return code === ErrorCodes.Unauthorized && sentToken !== undefined && sentToken === currentToken;
}
