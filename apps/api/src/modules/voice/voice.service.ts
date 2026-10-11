import { Injectable } from '@nestjs/common';
import { ErrorCodes, type VoiceIceServer, type VoicePeer } from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { VoiceRooms } from './voice-rooms.js';

export interface VoiceJoinOutcome {
  self: VoicePeer;
  /** Everyone already in the call. */
  peers: VoicePeer[];
  /** The call this connection was taken out of to join this one, if it was in another. */
  leftRoomId: string | null;
  /** It was in this call already: nobody needs telling that it joined. */
  already: boolean;
}

/**
 * Who may be in a room's call, and who is. A call belongs to a room: its members may join it
 * whether they are waiting in the room or playing its match, and nobody else may.
 */
@Injectable()
export class VoiceService {
  private readonly calls: VoiceRooms;

  constructor(
    private readonly rooms: RoomsService,
    private readonly config: AppConfig,
  ) {
    this.calls = new VoiceRooms(config.voiceMaxPeers);
  }

  get iceServers(): VoiceIceServer[] {
    return this.config.voiceIceServers;
  }

  async join(roomId: string, userId: string, peerId: string): Promise<VoiceJoinOutcome> {
    const room = await this.rooms.getDto(roomId);
    const member = room.members.find((candidate) => candidate.userId === userId);
    if (!member) {
      throw new AppError(ErrorCodes.NotRoomMember, 'Join the room before joining its call.', 403);
    }

    // Asking again for the call it is already in changes nothing.
    if (this.calls.roomOf(peerId) === roomId) {
      const all = this.calls.peers(roomId);
      const self = all.find((peer) => peer.peerId === peerId);
      if (self) {
        return {
          self,
          peers: all.filter((peer) => peer !== self),
          leftRoomId: null,
          already: true,
        };
      }
    }

    const leftRoomId = this.calls.leave(peerId);
    const self: VoicePeer = { peerId, userId, displayName: member.displayName, muted: false };
    const peers = this.calls.join(roomId, self);
    if (peers === 'full') {
      throw new AppError(ErrorCodes.VoiceFull, 'This call has no place left.', 409);
    }
    return { self, peers, leftRoomId, already: false };
  }

  /** Takes a connection out of its call, and says which call that was. */
  leave(peerId: string): string | null {
    return this.calls.leave(peerId);
  }

  /** A signal passes only between two connections in the same call. */
  assertCanSignal(roomId: string, fromPeerId: string, toPeerId: string): void {
    if (!this.calls.has(roomId, fromPeerId) || !this.calls.has(roomId, toPeerId)) {
      throw new AppError(ErrorCodes.NotInVoice, 'Both of you must be in the call.', 409);
    }
  }

  setMuted(roomId: string, peerId: string, muted: boolean): VoicePeer {
    const peer = this.calls.roomOf(peerId) === roomId ? this.calls.setMuted(peerId, muted) : null;
    if (!peer) throw new AppError(ErrorCodes.NotInVoice, 'You are not in this call.', 409);
    return peer;
  }

  /**
   * Takes out of a room's call everyone who is no longer one of its members, and says who they
   * were. A room that is gone has no members left.
   */
  async dropNonMembers(roomId: string): Promise<VoicePeer[]> {
    const inCall = this.calls.peers(roomId);
    if (inCall.length === 0) return [];
    const memberIds = await this.rooms
      .getDto(roomId)
      .then((room) => new Set(room.members.map((member) => member.userId)))
      .catch(() => new Set<string>());
    const dropped = inCall.filter((peer) => !memberIds.has(peer.userId));
    for (const peer of dropped) this.calls.leave(peer.peerId);
    return dropped;
  }
}
