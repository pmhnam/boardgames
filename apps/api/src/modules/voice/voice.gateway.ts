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
import { PlatformEvents, type RoomUpdatedEvent } from '../../common/events/platform-events.js';
import { parseWithSchema } from '../../common/pipes/zod-validation.pipe.js';
import { RateLimiter } from '../../common/rate-limit/rate-limiter.js';
import { toAck } from '../../common/realtime/ack.js';
import { voiceMuteSchema, voiceRoomSchema, voiceSignalSchema } from './voice.schemas.js';
import { VoiceService } from './voice.service.js';

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
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class VoiceGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private readonly limiters = new WeakMap<VoiceSocket, RateLimiter>();

  constructor(private readonly voice: VoiceService) {}

  handleDisconnect(socket: VoiceSocket): void {
    this.leaveCall(socket);
  }

  @SubscribeMessage(ClientEvents.VoiceJoin)
  join(
    @ConnectedSocket() socket: VoiceSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<VoiceJoined>> {
    return toAck(this.logger, async () => {
      const { roomId } = parseWithSchema(voiceRoomSchema, body);
      const joined = await this.voice.join(roomId, socket.data.userId, socket.id);
      // Gone while its membership was being looked up: nothing would ever take it out again.
      if (socket.disconnected) {
        this.leaveCall(socket);
        throw new AppError(ErrorCodes.NotInVoice, 'The connection closed.', 409);
      }
      if (joined.leftRoomId !== null) this.announceLeft(socket, joined.leftRoomId);
      await socket.join(callChannel(roomId));
      if (!joined.already) {
        const message: VoicePeerMessage = { roomId, peer: joined.self };
        socket.to(callChannel(roomId)).emit(ServerEvents.VoicePeerJoined, message);
      }
      return {
        roomId,
        peerId: socket.id,
        peers: joined.peers,
        iceServers: this.voice.iceServers,
      };
    });
  }

  @SubscribeMessage(ClientEvents.VoiceLeave)
  leave(@ConnectedSocket() socket: VoiceSocket): Promise<Ack<null>> {
    return toAck(this.logger, () => {
      this.leaveCall(socket);
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
      this.voice.assertCanSignal(roomId, socket.id, toPeerId);
      const message: VoiceSignalMessage = { roomId, fromPeerId: socket.id, signal };
      // Every connection is alone in the channel named after it.
      this.server.to(toPeerId).emit(ServerEvents.VoiceSignal, message);
      return null;
    });
  }

  @SubscribeMessage(ClientEvents.VoiceMute)
  mute(@ConnectedSocket() socket: VoiceSocket, @MessageBody() body: unknown): Promise<Ack<null>> {
    return toAck(this.logger, () => {
      const { roomId, muted } = parseWithSchema(voiceMuteSchema, body);
      const message: VoicePeerMessage = {
        roomId,
        peer: this.voice.setMuted(roomId, socket.id, muted),
      };
      this.server.to(callChannel(roomId)).emit(ServerEvents.VoicePeerMuted, message);
      return null;
    });
  }

  /** Someone who left the room, or was removed from it, leaves its call with it. */
  @OnEvent(PlatformEvents.RoomUpdated)
  async onRoomUpdated(event: RoomUpdatedEvent): Promise<void> {
    for (const peer of await this.voice.dropNonMembers(event.roomId)) {
      const message: VoicePeerLeftMessage = { roomId: event.roomId, peerId: peer.peerId };
      // Told as well as the others: its own browser has a microphone to let go of.
      this.server.to(callChannel(event.roomId)).emit(ServerEvents.VoicePeerLeft, message);
      this.server.in(peer.peerId).socketsLeave(callChannel(event.roomId));
    }
  }

  private leaveCall(socket: VoiceSocket): void {
    const roomId = this.voice.leave(socket.id);
    if (roomId !== null) this.announceLeft(socket, roomId);
  }

  private announceLeft(socket: VoiceSocket, roomId: string): void {
    void socket.leave(callChannel(roomId));
    const message: VoicePeerLeftMessage = { roomId, peerId: socket.id };
    this.server.to(callChannel(roomId)).emit(ServerEvents.VoicePeerLeft, message);
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
