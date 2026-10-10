import type { AuthSessionDto } from '@bgp/shared-types';
import { describe, expect, it } from 'vitest';
import { isAdmin } from './roles';

function session(role?: string): AuthSessionDto {
  return {
    accessToken: 'token',
    user: { id: 'u1', displayName: 'Someone', avatarUrl: null, role },
  } as AuthSessionDto;
}

describe('isAdmin', () => {
  it('is true only for a session whose user is an administrator', () => {
    expect(isAdmin(session('admin'))).toBe(true);
    expect(isAdmin(session('player'))).toBe(false);
  });

  it('treats a missing session, and one stored before roles existed, as a player', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
    expect(isAdmin(session())).toBe(false);
  });
});
