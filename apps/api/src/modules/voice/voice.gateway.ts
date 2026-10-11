import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayDisconnect,
} from '@nestjs/websockets';
import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type VoiceJoined,
  type VoicePeerLeftMessage,
  type VoicePeerMessage,
  type VoiceSignalMessage,
} from '@bgp/shared-types';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import { AppError } from '../../common/errors/app-error.js';
import { GATEWAY_OPTIONS } from '../../common/realtime/gateway-options.js';
import { PlatformEvents, type RoomUpdatedEvent } from '../../common/events/platform-events.js';
import { parseWithSchema } from '../../common/pipes/zod-validation.pipe.js';
import { RateLimiter } from '../../common/rate-limit/rate-limiter.js';
import { toAck } from '../../common/realtime/ack.js';
import { voiceMuteSchema, voiceRoomSchema, voiceSignalSchema } from './voice.schemas.js';
import { VoiceService, type VoiceDeparture } from './voice.service.js';

/** Set by the realtime gateway's handshake check, which every connection has passed. */
type VoiceSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, { userId: string }>;

// Opening one connection takes an offer, an answer and a few dozen candidates each way, and
// someone joining a full call opens seven at once.
const SIGNAL_BURST = 600;
const SIGNALS_PER_SECOND = 60;

const callChannel = (roomId: string) => `voice:${roomId}`;

/**
 * The signalling for calls. The sound never comes here: this only says who is in a room's
 * call and passes each browser's connection details to the one it names.
 */
@WebSocketGateway(GATEWAY_OPTIONS)
export class VoiceGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private readonly limiters = new WeakMap<VoiceSocket, RateLimiter>();

  constructor(private readonly voice: VoiceService) {}

  /** Its place is kept for a while: a phone's connection drops and returns all the time. */
  handleDisconnect(socket: VoiceSocket): void {
    this.voice.dropped(socket.id, (departure) => this.announceLeft(departure));
  }

  @SubscribeMessage(ClientEvents.VoiceJoin)
  join(
    @ConnectedSocket() socket: VoiceSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<VoiceJoined>> {
    return toAck(this.logger, async () => {
      const { roomId, peerId = socket.id } = parseWithSchema(voiceRoomSchema, body);
      const joined = await this.voice.join(roomId, socket.data.userId, peerId, socket.id);
      if (joined.left) this.announceLeft(joined.left);
      // Gone while its membership was being looked up: nothing else would ever notice.
      if (socket.disconnected) {
        this.handleDisconnect(socket);
        throw new AppError(ErrorCodes.NotInVoice, 'The connection closed.', 409);
      }
      await socket.join(callChannel(roomId));
      // Said of one who is back as well: whoever was mending a connection to it can try again.
      if (!joined.already || joined.resumed) {
        const message: VoicePeerMessage = { roomId, peer: joined.self };
        socket.to(callChannel(roomId)).emit(ServerEvents.VoicePeerJoined, message);
      }
      return {
        roomId,
        peerId,
        peers: joined.peers,
        iceServers: this.voice.iceServers,
        resumed: joined.resumed,
      };
    });
  }

  @SubscribeMessage(ClientEvents.VoiceLeave)
  leave(@ConnectedSocket() socket: VoiceSocket): Promise<Ack<null>> {
    return toAck(this.logger, () => {
      const peerId = this.voice.peerOf(socket.id);
      const departure = peerId === null ? null : this.voice.leave(peerId);
      if (departure) this.announceLeft(departure);
      return null;
    });
  }

  @SubscribeMessage(ClientEvents.VoiceSignal)
  signal(@ConnectedSocket() socket: VoiceSocket, @MessageBody() body: unknown): Promise<Ack<null>> {
    return toAck(this.logger, () => {
      if (!this.limiterOf(socket).tryConsume()) {
        throw new AppError(ErrorCodes.RateLimited, 'Too many signals. Slow down.', 429);
      }
      const { roomId, toPeerId, signal } = parseWithSchema(voiceSignalSchema, body);
      const fromPeerId = this.voice.peerOf(socket.id);
      this.voice.assertCanSignal(roomId, fromPeerId, toPeerId);
      // A peer whose connection is down misses this. Its browser asks again when it is back.
      const to = this.voice.socketOf(toPeerId);
      if (to !== null && fromPeerId !== null) {
        const message: VoiceSignalMessage = { roomId, fromPeerId, signal };
        // Every connection is alone in the channel named after it.
        this.server.to(to).emit(ServerEvents.VoiceSignal, message);
      }
      return null;
    });
  }

  @SubscribeMessage(ClientEvents.VoiceMute)
  mute(@ConnectedSocket() socket: VoiceSocket, @MessageBody() body: unknown): Promise<Ack<null>> {
    return toAck(this.logger, () => {
      const { roomId, muted } = parseWithSchema(voiceMuteSchema, body);
      const message: VoicePeerMessage = {
        roomId,
        peer: this.voice.setMuted(roomId, this.voice.peerOf(socket.id), muted),
      };
      this.server.to(callChannel(roomId)).emit(ServerEvents.VoicePeerMuted, message);
      return null;
    });
  }

  /** Someone who left the room, or was removed from it, leaves its call with it. */
  @OnEvent(PlatformEvents.RoomUpdated)
  onRoomUpdated(event: RoomUpdatedEvent): void {
    const memberIds = new Set(event.room.members.map((member) => member.userId));
    for (const departure of this.voice.dropNonMembers(event.roomId, memberIds)) {
      this.announceLeft(departure);
    }
  }

  /**
   * Tells the call, the one who left included: its own browser has a microphone to let go of.
   * Only then is its socket taken out of the call's channel.
   */
  private announceLeft({ roomId, peerId, socketId }: VoiceDeparture): void {
    const message: VoicePeerLeftMessage = { roomId, peerId };
    this.server.to(callChannel(roomId)).emit(ServerEvents.VoicePeerLeft, message);
    if (socketId !== null) this.server.in(socketId).socketsLeave(callChannel(roomId));
  }

  private limiterOf(socket: VoiceSocket): RateLimiter {
    let limiter = this.limiters.get(socket);
    if (!limiter) {
      limiter = new RateLimiter(SIGNAL_BURST, SIGNALS_PER_SECOND);
      this.limiters.set(socket, limiter);
    }
    return limiter;
  }
}
