import type { RoomDto, RoomMemberDto } from '@bgp/shared-types';
import { describe, expect, it } from 'vitest';
import { emptySeats, primaryAction, startBlocker } from './room-actions';

const member = (userId: string, status: RoomMemberDto['status'] = 'ready'): RoomMemberDto => ({
  userId,
  displayName: userId,
  seat: 0,
  status,
  botLevel: null,
});

const room = (
  members: RoomMemberDto[],
  status: RoomDto['status'] = 'open',
): Pick<RoomDto, 'members' | 'hostUserId' | 'status'> => ({ members, hostUserId: 'host', status });

const game = { minPlayers: 3 };

describe('startBlocker', () => {
  it('asks for the players still missing before anything else', () => {
    expect(startBlocker(room([member('host', 'joined')]), game)).toEqual({
      kind: 'needPlayers',
      missing: 2,
    });
  });

  it('counts who is not ready once there are enough players', () => {
    const members = [member('host'), member('an', 'joined'), member('binh', 'joined')];
    expect(startBlocker(room(members), game)).toEqual({ kind: 'notReady', waiting: 2 });
  });

  it('lets the match start when everyone seated is ready', () => {
    expect(startBlocker(room([member('host'), member('an'), member('binh')]), game)).toBeNull();
  });

  it('leaves the player count to the server for a game it knows nothing about', () => {
    expect(startBlocker(room([member('host')]), undefined)).toBeNull();
    expect(startBlocker(room([member('host', 'joined')]), undefined)).toEqual({
      kind: 'notReady',
      waiting: 1,
    });
  });
});

describe('primaryAction', () => {
  const full = [member('host'), member('an'), member('binh')];

  it('offers a seat to someone who has none', () => {
    expect(primaryAction(room(full), 'chi', null)).toBe('sit');
    expect(primaryAction(room(full), undefined, null)).toBe('sit');
  });

  it('asks a seated player to be ready first, the host included', () => {
    const members = [member('host', 'joined'), member('an', 'joined'), member('binh')];
    const blocker = startBlocker(room(members), game);
    expect(primaryAction(room(members), 'an', blocker)).toBe('ready');
    expect(primaryAction(room(members), 'host', blocker)).toBe('ready');
  });

  it('gives the host the start once nothing is in the way', () => {
    expect(primaryAction(room(full), 'host', null)).toBe('start');
  });

  it('has nothing for a ready host to do while the match cannot start', () => {
    const members = [member('host'), member('an', 'joined'), member('binh')];
    expect(primaryAction(room(members), 'host', startBlocker(room(members), game))).toBeNull();
  });

  it('has nothing for a ready guest to do but wait', () => {
    expect(primaryAction(room(full), 'an', null)).toBeNull();
  });

  it('offers nothing once the room is no longer open', () => {
    expect(primaryAction(room(full, 'in_match'), 'host', null)).toBeNull();
    expect(primaryAction(room(full, 'in_match'), 'chi', null)).toBeNull();
  });
});

describe('emptySeats', () => {
  const limits = { minPlayers: 3, maxPlayers: 8 };
  const seated = (count: number) =>
    room(Array.from({ length: count }, (_, index) => member(`player-${index}`)));

  it('draws the seats that must be filled, then a few of the ones that may stay empty', () => {
    expect(emptySeats(seated(1), limits)).toEqual({ required: 2, optional: 3, more: 2 });
  });

  it('asks for nobody once there are enough players', () => {
    expect(emptySeats(seated(3), limits)).toEqual({ required: 0, optional: 3, more: 2 });
    expect(emptySeats(seated(6), limits)).toEqual({ required: 0, optional: 2, more: 0 });
  });

  it('draws nothing at a full table', () => {
    expect(emptySeats(seated(8), limits)).toEqual({ required: 0, optional: 0, more: 0 });
  });

  it('draws as many spare seats as it is told to', () => {
    expect(emptySeats(seated(3), limits, 1)).toEqual({ required: 0, optional: 1, more: 4 });
  });

  it('draws nothing for a game it knows nothing about', () => {
    expect(emptySeats(seated(1), undefined)).toEqual({ required: 0, optional: 0, more: 0 });
  });
});
