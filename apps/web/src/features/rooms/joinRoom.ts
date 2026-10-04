import type { RoomDto } from '@bgp/shared-types';
import { api } from '../../shared/api/http';

/** Takes a seat in a room. Joining one you are already in is fine: the server hands it back. */
export function joinRoom(roomId: string): Promise<RoomDto> {
  return api<RoomDto>('POST', `/rooms/${roomId}/join`);
}

/** Resolves an invite code to its room, then takes a seat there. */
export async function joinByCode(code: string): Promise<RoomDto> {
  const room = await api<RoomDto>('GET', `/rooms/by-code/${encodeURIComponent(code)}`);
  return joinRoom(room.id);
}
