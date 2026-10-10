import type { GameDefinitionDto, RoomDto } from '@bgp/shared-types';

/*
 * What the room page offers. The server decides for itself on every request; these only say
 * ahead of time why a match cannot start yet, and which button is the thing to do next.
 */

/** Why the match cannot start yet, in the order the server checks. */
export type StartBlocker =
  { kind: 'needPlayers'; missing: number } | { kind: 'notReady'; waiting: number };

export function startBlocker(
  room: Pick<RoomDto, 'members'>,
  game: Pick<GameDefinitionDto, 'minPlayers'> | undefined,
): StartBlocker | null {
  // A game we know nothing about: let the server say whether there are enough players.
  const missing = (game?.minPlayers ?? 0) - room.members.length;
  if (missing > 0) return { kind: 'needPlayers', missing };
  const waiting = room.members.filter((member) => member.status !== 'ready').length;
  return waiting > 0 ? { kind: 'notReady', waiting } : null;
}

export type RoomAction = 'sit' | 'ready' | 'start';

/** The one thing the viewer is expected to do next, or null while it is up to someone else. */
export function primaryAction(
  room: Pick<RoomDto, 'members' | 'hostUserId' | 'status'>,
  userId: string | undefined,
  blocker: StartBlocker | null,
): RoomAction | null {
  if (room.status !== 'open') return null;
  const me = room.members.find((member) => member.userId === userId);
  if (!me) return 'sit';
  if (me.status !== 'ready') return 'ready';
  return room.hostUserId === userId && blocker === null ? 'start' : null;
}
