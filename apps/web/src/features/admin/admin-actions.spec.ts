import type { AdminUserDto } from '@bgp/shared-types';
import { describe, expect, it } from 'vitest';
import { matchActions, playerActions, roomActions } from './admin-actions';

describe('matchActions', () => {
  it('offers to end a match only while it is being played', () => {
    expect(matchActions({ status: 'playing' }).canAbandon).toBe(true);
    expect(matchActions({ status: 'finished' }).canAbandon).toBe(false);
    expect(matchActions({ status: 'abandoned' }).canAbandon).toBe(false);
  });
});

describe('roomActions', () => {
  it('lets an open room be closed and its members removed', () => {
    expect(roomActions({ status: 'open' })).toEqual({
      canClose: true,
      canRemoveMembers: true,
      blockedByMatch: false,
    });
  });

  it('holds everything back while a match is being played, and says that is why', () => {
    expect(roomActions({ status: 'in_match' })).toEqual({
      canClose: false,
      canRemoveMembers: false,
      blockedByMatch: true,
    });
  });

  it('offers nothing for a room that is already closed', () => {
    expect(roomActions({ status: 'closed' })).toEqual({
      canClose: false,
      canRemoveMembers: false,
      blockedByMatch: false,
    });
  });
});

describe('playerActions', () => {
  const user = (patch: Partial<AdminUserDto> = {}): AdminUserDto => ({
    id: 'u1',
    displayName: 'Someone',
    role: 'player',
    isBot: false,
    disabledAt: null,
    createdAt: '2026-10-10T10:00:00.000Z',
    ...patch,
  });

  it('offers to disable an active player and to enable a disabled one, never both', () => {
    expect(playerActions(user(), 'admin')).toEqual({
      canDisable: true,
      canEnable: false,
      blocker: null,
    });
    expect(playerActions(user({ disabledAt: '2026-10-10T11:00:00.000Z' }), 'admin')).toEqual({
      canDisable: false,
      canEnable: true,
      blocker: null,
    });
  });

  it('never offers an administrator their own account', () => {
    expect(playerActions(user({ id: 'me', role: 'admin' }), 'me')).toEqual({
      canDisable: false,
      canEnable: false,
      blocker: 'self',
    });
  });

  it('leaves other administrators and computer players alone, and says which it is', () => {
    expect(playerActions(user({ role: 'admin' }), 'me').blocker).toBe('admin');
    expect(playerActions(user({ isBot: true }), 'me').blocker).toBe('bot');
    expect(playerActions(user({ isBot: true }), 'me').canDisable).toBe(false);
  });
});
