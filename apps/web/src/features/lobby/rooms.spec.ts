import type { RoomDto, RoomMemberDto } from '@bgp/shared-types';
import { describe, expect, it } from 'vitest';
import { classifyRoom, countBots, partitionRooms } from './rooms';

const game = { gameType: 'splendor', maxPlayers: 3, supportsSpectators: true };
const noSpectators = { ...game, gameType: 'secret', supportsSpectators: false };

function member(userId: string, botLevel: RoomMemberDto['botLevel'] = null): RoomMemberDto {
  return { userId, displayName: userId, seat: 0, status: 'joined', botLevel };
}

function room(patch: Partial<RoomDto> & { id: string }): RoomDto {
  return {
    code: patch.id.toUpperCase(),
    gameType: game.gameType,
    hostUserId: 'host',
    status: 'open',
    visibility: 'public',
    settings: {},
    members: [member('host')],
    currentMatchId: null,
    createdAt: '2026-10-04T10:00:00.000Z',
    ...patch,
  };
}

describe('classifyRoom', () => {
  it('is mine when I have a seat, whatever else is true of it', () => {
    const playing = room({ id: 'a', status: 'in_match', currentMatchId: 'm1' });
    expect(classifyRoom(playing, game, 'host')).toBe('mine');
    expect(classifyRoom(room({ id: 'b' }), game, 'host')).toBe('mine');
  });

  it('is joinable while open with a seat free, and full once the last seat is taken', () => {
    const twoSeated = room({ id: 'a', members: [member('host'), member('x')] });
    const threeSeated = room({ id: 'b', members: [member('host'), member('x'), member('y')] });
    expect(classifyRoom(twoSeated, game, 'me')).toBe('joinable');
    expect(classifyRoom(threeSeated, game, 'me')).toBe('full');
  });

  it('is watchable during a match only if the game lets people watch', () => {
    const playing = room({ id: 'a', status: 'in_match', currentMatchId: 'm1' });
    expect(classifyRoom(playing, game, 'me')).toBe('watchable');
    expect(classifyRoom(playing, noSpectators, 'me')).toBe('playing');
  });

  it('is only playing when it is in a match the lobby was not told about', () => {
    const playing = room({ id: 'a', status: 'in_match', currentMatchId: null });
    expect(classifyRoom(playing, game, 'me')).toBe('playing');
  });

  it('leaves it to the server when the game is unknown', () => {
    expect(classifyRoom(room({ id: 'a' }), undefined, 'me')).toBe('joinable');
  });

  it('treats a viewer who is not signed in as a stranger to every room', () => {
    expect(classifyRoom(room({ id: 'a' }), game, undefined)).toBe('joinable');
  });
});

describe('partitionRooms', () => {
  const older = '2026-10-04T09:00:00.000Z';
  const newer = '2026-10-04T11:00:00.000Z';

  it('separates my rooms from the rest', () => {
    const rooms = [room({ id: 'theirs' }), room({ id: 'mine', members: [member('me')] })];
    const { mine, others } = partitionRooms(rooms, [game], 'me');
    expect(mine.map((r) => r.id)).toEqual(['mine']);
    expect(others.map((entry) => entry.room.id)).toEqual(['theirs']);
  });

  it('lists what can be joined, then watched, then full, then merely playing', () => {
    const full = [member('host'), member('x'), member('y')];
    const rooms = [
      room({ id: 'closed-doors', gameType: 'secret', status: 'in_match', currentMatchId: 'm2' }),
      room({ id: 'full', members: full }),
      room({ id: 'watch', status: 'in_match', currentMatchId: 'm1' }),
      room({ id: 'join' }),
    ];
    const { others } = partitionRooms(rooms, [game, noSpectators], 'me');
    expect(others.map((entry) => [entry.room.id, entry.standing])).toEqual([
      ['join', 'joinable'],
      ['watch', 'watchable'],
      ['full', 'full'],
      ['closed-doors', 'playing'],
    ]);
  });

  it('puts the newest first among rooms of the same standing', () => {
    const rooms = [room({ id: 'old', createdAt: older }), room({ id: 'new', createdAt: newer })];
    const { others } = partitionRooms(rooms, [game], 'me');
    expect(others.map((entry) => entry.room.id)).toEqual(['new', 'old']);
  });

  it('puts my match under way ahead of my newer waiting room', () => {
    const me = [member('me')];
    const rooms = [
      room({ id: 'waiting', members: me, createdAt: newer }),
      room({
        id: 'match',
        members: me,
        status: 'in_match',
        currentMatchId: 'm1',
        createdAt: older,
      }),
    ];
    expect(partitionRooms(rooms, [game], 'me').mine.map((r) => r.id)).toEqual(['match', 'waiting']);
  });
});

describe('countBots', () => {
  it('counts the computer players seated', () => {
    const seated = [member('host'), member('bot-1', 'easy'), member('bot-2', 'hard')];
    expect(countBots(room({ id: 'a', members: seated }))).toBe(2);
    expect(countBots(room({ id: 'b' }))).toBe(0);
  });
});
