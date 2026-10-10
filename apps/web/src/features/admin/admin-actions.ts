import type { AdminMatchDto, AdminRoomDto, AdminUserDto } from '@bgp/shared-types';

/*
 * What the admin pages offer for a given row. The server decides for itself on every request;
 * these only keep buttons that cannot work off the page, and say why they are missing.
 */

export interface MatchActions {
  /** Only a match still being played can be ended. */
  canAbandon: boolean;
}

export function matchActions(match: Pick<AdminMatchDto, 'status'>): MatchActions {
  return { canAbandon: match.status === 'playing' };
}

export interface RoomActions {
  canClose: boolean;
  canRemoveMembers: boolean;
  /** A match is being played here, and has to be ended before the room can be changed. */
  blockedByMatch: boolean;
}

export function roomActions(room: Pick<AdminRoomDto, 'status'>): RoomActions {
  const open = room.status === 'open';
  return { canClose: open, canRemoveMembers: open, blockedByMatch: room.status === 'in_match' };
}

/** Why an account cannot be disabled from here, or null when it can. */
export type DisableBlocker = 'self' | 'admin' | 'bot' | null;

export interface PlayerActions {
  canDisable: boolean;
  canEnable: boolean;
  blocker: DisableBlocker;
}

export function playerActions(
  user: Pick<AdminUserDto, 'id' | 'role' | 'isBot' | 'disabledAt'>,
  selfId: string | undefined,
): PlayerActions {
  const blocker: DisableBlocker =
    user.id === selfId ? 'self' : user.role === 'admin' ? 'admin' : user.isBot ? 'bot' : null;
  const disabled = user.disabledAt !== null;
  return {
    canDisable: blocker === null && !disabled,
    canEnable: blocker === null && disabled,
    blocker,
  };
}
