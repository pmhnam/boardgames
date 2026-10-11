import type { VoicePeer } from '@bgp/shared-types';

/**
 * Who is in which room's call. Kept in memory and nowhere else: a call is nothing but its open
 * connections, and those do not outlive the process either.
 */
export class VoiceRooms {
  private readonly calls = new Map<string, Map<string, VoicePeer>>();
  private readonly roomOfPeer = new Map<string, string>();

  constructor(private readonly capacity: number) {}

  /**
   * Adds a connection to a room's call and says who was already there, or `full` when the call
   * has no place left. A connection is in one call at a time: take it out of the last first.
   */
  join(roomId: string, peer: VoicePeer): VoicePeer[] | 'full' {
    if (this.roomOfPeer.has(peer.peerId)) throw new Error('Peer is already in a call');
    const call = this.calls.get(roomId) ?? new Map<string, VoicePeer>();
    if (call.size >= this.capacity) return 'full';
    const others = [...call.values()];
    call.set(peer.peerId, peer);
    this.calls.set(roomId, call);
    this.roomOfPeer.set(peer.peerId, roomId);
    return others;
  }

  /** Takes a connection out of whatever call it is in, and says which that was. */
  leave(peerId: string): string | null {
    const roomId = this.roomOfPeer.get(peerId);
    if (roomId === undefined) return null;
    this.roomOfPeer.delete(peerId);
    const call = this.calls.get(roomId);
    call?.delete(peerId);
    if (call?.size === 0) this.calls.delete(roomId);
    return roomId;
  }

  roomOf(peerId: string): string | null {
    return this.roomOfPeer.get(peerId) ?? null;
  }

  peers(roomId: string): VoicePeer[] {
    return [...(this.calls.get(roomId)?.values() ?? [])];
  }

  has(roomId: string, peerId: string): boolean {
    return this.calls.get(roomId)?.has(peerId) ?? false;
  }

  /** Records a connection's microphone as muted or not, and hands back how it now stands. */
  setMuted(peerId: string, muted: boolean): VoicePeer | null {
    const roomId = this.roomOfPeer.get(peerId);
    const call = roomId === undefined ? undefined : this.calls.get(roomId);
    const peer = call?.get(peerId);
    if (!call || !peer) return null;
    const next = { ...peer, muted };
    call.set(peerId, next);
    return next;
  }
}
