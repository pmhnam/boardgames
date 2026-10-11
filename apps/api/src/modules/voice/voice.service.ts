import { Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ErrorCodes, type VoiceIceServer, type VoicePeer } from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import { AppConfig } from '../../config/app-config.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { VoiceRooms } from './voice-rooms.js';

/** A peer no longer in a call, and the call it was in. */
export interface VoiceDeparture {
  roomId: string;
  peerId: string;
  /** The socket it was last on, if that is still there to be taken out of the call's channel. */
  socketId: string | null;
}

export interface VoiceJoinOutcome {
  self: VoicePeer;
  /** Everyone else in the call. */
  peers: VoicePeer[];
  /** What this socket was taken out of to join this call, if it was in another. */
  left: VoiceDeparture | null;
  /** It held this place already: nobody needs telling that it joined. */
  already: boolean;
  /** It held this place on another socket, which dropped: it is back. */
  resumed: boolean;
}

/** Whose a peer is, and the socket it is on right now. */
interface Seat {
  userId: string;
  /** Null while its connection is down and its place is being kept. */
  socketId: string | null;
  away: NodeJS.Timeout | null;
}

/**
 * Who may be in a room's call, and who is. A call belongs to a room: its members may join it
 * whether they are waiting in the room or playing its match, and nobody else may.
 *
 * A peer is one browser's part in a call, under a name that browser chose. Phones lose their
 * connection to the server for a moment all the time, while the sound, which goes from browser
 * to browser, carries on: a peer whose socket drops keeps its place for a while, and takes it
 * back under the same name when the socket returns.
 */
@Injectable()
export class VoiceService implements OnApplicationShutdown {
  private readonly calls: VoiceRooms;
  private readonly seats = new Map<string, Seat>();
  private readonly peerOfSocket = new Map<string, string>();

  constructor(
    private readonly rooms: RoomsService,
    private readonly config: AppConfig,
  ) {
    this.calls = new VoiceRooms(config.voiceMaxPeers);
  }

  onApplicationShutdown(): void {
    for (const seat of this.seats.values()) if (seat.away) clearTimeout(seat.away);
  }

  get iceServers(): VoiceIceServer[] {
    return this.config.voiceIceServers;
  }

  async join(
    roomId: string,
    userId: string,
    peerId: string,
    socketId: string,
  ): Promise<VoiceJoinOutcome> {
    const room = await this.rooms.getDto(roomId);
    const member = room.members.find((candidate) => candidate.userId === userId);
    if (!member) {
      throw new AppError(ErrorCodes.NotRoomMember, 'Join the room before joining its call.', 403);
    }
    const seat = this.seats.get(peerId);
    // A peer's name is seen by everyone in its call; knowing it must not be enough to take it.
    if (seat && seat.userId !== userId) {
      throw new AppError(ErrorCodes.Forbidden, 'That place in the call is someone else’s.', 403);
    }

    // A socket is in one call at a time, as one peer.
    const bound = this.peerOfSocket.get(socketId);
    let left = bound !== undefined && bound !== peerId ? this.leave(bound) : null;

    if (seat && this.calls.roomOf(peerId) === roomId) {
      const all = this.calls.peers(roomId);
      const self = all.find((peer) => peer.peerId === peerId);
      if (self) {
        const resumed = seat.socketId !== socketId;
        if (resumed) this.seat(peerId, seat, socketId);
        return { self, peers: all.filter((peer) => peer !== self), left, already: true, resumed };
      }
    }

    left = this.leave(peerId) ?? left;
    const self: VoicePeer = { peerId, userId, displayName: member.displayName, muted: false };
    const peers = this.calls.join(roomId, self);
    if (peers === 'full') {
      throw new AppError(ErrorCodes.VoiceFull, 'This call has no place left.', 409);
    }
    this.seat(peerId, { userId, socketId: null, away: null }, socketId);
    return { self, peers, left, already: false, resumed: false };
  }

  /** Takes a peer out of its call for good, and says which call that was. */
  leave(peerId: string): VoiceDeparture | null {
    const seat = this.seats.get(peerId);
    if (seat?.away) clearTimeout(seat.away);
    if (seat?.socketId) this.peerOfSocket.delete(seat.socketId);
    this.seats.delete(peerId);
    const roomId = this.calls.leave(peerId);
    return roomId === null ? null : { roomId, peerId, socketId: seat?.socketId ?? null };
  }

  /**
   * A socket closed. The peer on it keeps its place for a while; `onGone` is told if nothing
   * has come back for it by then.
   */
  dropped(socketId: string, onGone: (departure: VoiceDeparture) => void): void {
    const peerId = this.peerOfSocket.get(socketId);
    const seat = peerId === undefined ? undefined : this.seats.get(peerId);
    if (peerId === undefined || !seat) return;
    this.peerOfSocket.delete(socketId);
    seat.socketId = null;
    const gone = () => {
      const departure = this.leave(peerId);
      if (departure) onGone(departure);
    };
    if (this.config.voiceResumeGraceMs === 0) return gone();
    seat.away = setTimeout(gone, this.config.voiceResumeGraceMs);
    seat.away.unref();
  }

  /** The peer a socket is in a call as, if it is in one. */
  peerOf(socketId: string): string | null {
    return this.peerOfSocket.get(socketId) ?? null;
  }

  /** Where to send what is addressed to a peer. Null while its connection is down. */
  socketOf(peerId: string): string | null {
    return this.seats.get(peerId)?.socketId ?? null;
  }

  /** A signal passes only between two peers in the same call. */
  assertCanSignal(roomId: string, fromPeerId: string | null, toPeerId: string): void {
    if (
      fromPeerId === null ||
      !this.calls.has(roomId, fromPeerId) ||
      !this.calls.has(roomId, toPeerId)
    ) {
      throw new AppError(ErrorCodes.NotInVoice, 'Both of you must be in the call.', 409);
    }
  }

  setMuted(roomId: string, peerId: string | null, muted: boolean): VoicePeer {
    const peer =
      peerId !== null && this.calls.roomOf(peerId) === roomId
        ? this.calls.setMuted(peerId, muted)
        : null;
    if (!peer) throw new AppError(ErrorCodes.NotInVoice, 'You are not in this call.', 409);
    return peer;
  }

  /**
   * Takes out of a room's call everyone who is not among its members as they now stand, and
   * says who they were. A room that is gone has no members left.
   */
  dropNonMembers(roomId: string, memberIds: ReadonlySet<string>): VoiceDeparture[] {
    return this.calls
      .peers(roomId)
      .filter((peer) => !memberIds.has(peer.userId))
      .map((peer) => this.leave(peer.peerId))
      .filter((departure) => departure !== null);
  }

  /** Puts a peer on a socket, in place of whichever it was on. */
  private seat(peerId: string, seat: Seat, socketId: string): void {
    if (seat.away) clearTimeout(seat.away);
    if (seat.socketId) this.peerOfSocket.delete(seat.socketId);
    seat.away = null;
    seat.socketId = socketId;
    this.seats.set(peerId, seat);
    this.peerOfSocket.set(socketId, peerId);
  }
}
