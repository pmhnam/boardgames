import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayInit,
} from '@nestjs/websockets';
import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type GameActionAccepted,
  type GameFinishedMessage,
  type GameStartedMessage,
  type GameStateMessage,
  type RoomDto,
} from '@bgp/shared-types';
import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import type { z } from 'zod';
import { AppError } from '../../common/errors/app-error.js';
import {
  PlatformEvents,
  type MatchStartedEvent,
  type MatchStateChangedEvent,
  type RoomUpdatedEvent,
  type MatchFinishedEvent,
  type UserDisabledEvent,
} from '../../common/events/platform-events.js';
import { toAck } from '../../common/realtime/ack.js';
import { GATEWAY_OPTIONS } from '../../common/realtime/gateway-options.js';
import { parseWithSchema } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService } from '../auth/auth.service.js';
import { GameActionService } from '../matches/game-action.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { RateLimiter } from '../../common/rate-limit/rate-limiter.js';
import { gameActionSchema, gameSyncSchema, roomSubscriptionSchema } from './realtime.schemas.js';

interface SocketData {
  /** Set once, from the verified handshake token. */
  userId: string;
  actionLimiter: RateLimiter;
}

type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

const ACTION_BURST = 20;
const ACTIONS_PER_SECOND = 5;

/** However fast rooms change, the lobby is told at most this often. */
const LOBBY_NOTICE_INTERVAL_MS = 2000;

const channels = {
  /** Everyone looking at the list of rooms. */
  lobby: 'lobby',
  room: (roomId: string) => `room:${roomId}`,
  match: (matchId: string) => `match:${matchId}`,
  matchPlayer: (matchId: string, playerId: string) => `match:${matchId}:player:${playerId}`,
  matchSpectators: (matchId: string) => `match:${matchId}:spectators`,
  /** Every connection a person has open, whatever they are looking at. */
  user: (userId: string) => `user:${userId}`,
};

/**
 * Transport only: authenticate, validate shapes, delegate, relay. No game or room rules here.
 */
@WebSocketGateway(GATEWAY_OPTIONS)
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnApplicationShutdown {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  private lobbyNoticeAt = 0;
  private lobbyNoticeTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly rooms: RoomsService,
    private readonly matches: MatchesService,
    private readonly actions: GameActionService,
  ) {}

  afterInit(server: Server): void {
    server.use((socket: AppSocket, next) => {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      this.auth
        .verifyAccessToken(typeof token === 'string' ? token : undefined)
        .then(({ userId }) => {
          socket.data.userId = userId;
          socket.data.actionLimiter = new RateLimiter(ACTION_BURST, ACTIONS_PER_SECOND);
          next();
        })
        .catch(() => next(new Error(ErrorCodes.Unauthorized)));
    });
  }

  async handleConnection(socket: AppSocket): Promise<void> {
    this.logger.debug(`socket connected user=${socket.data.userId}`);
    await socket.join(channels.user(socket.data.userId));
  }

  onApplicationShutdown(): void {
    if (this.lobbyNoticeTimer) clearTimeout(this.lobbyNoticeTimer);
  }

  /** The lobby's room list is fetched over HTTP; this only asks to be told when to fetch it. */
  @SubscribeMessage(ClientEvents.LobbyJoin)
  subscribeToLobby(@ConnectedSocket() socket: AppSocket): Promise<Ack<null>> {
    return this.ack(async () => {
      await socket.join(channels.lobby);
      return null;
    });
  }

  @SubscribeMessage(ClientEvents.LobbyLeave)
  unsubscribeFromLobby(@ConnectedSocket() socket: AppSocket): Promise<Ack<null>> {
    return this.ack(async () => {
      await socket.leave(channels.lobby);
      return null;
    });
  }

  @SubscribeMessage(ClientEvents.RoomJoin)
  subscribeToRoom(
    @ConnectedSocket() socket: AppSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<RoomDto>> {
    return this.ack(async () => {
      const { roomId } = this.parse(roomSubscriptionSchema, body);
      if (!(await this.rooms.isMember(roomId, socket.data.userId))) {
        throw new AppError(ErrorCodes.NotRoomMember, 'Join the room before subscribing.', 403);
      }
      await socket.join(channels.room(roomId));
      return this.rooms.getDto(roomId);
    });
  }

  @SubscribeMessage(ClientEvents.RoomLeave)
  unsubscribeFromRoom(
    @ConnectedSocket() socket: AppSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<null>> {
    return this.ack(async () => {
      const { roomId } = this.parse(roomSubscriptionSchema, body);
      await socket.leave(channels.room(roomId));
      return null;
    });
  }

  /** Subscribes to a match and returns the latest personalised snapshot. Used on every (re)connect. */
  @SubscribeMessage(ClientEvents.GameSync)
  sync(
    @ConnectedSocket() socket: AppSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<GameStateMessage>> {
    return this.ack(async () => {
      const { gameId } = this.parse(gameSyncSchema, body);
      const { match, player, players } = await this.matches.getAccess(gameId, socket.data.userId);

      await socket.join(channels.match(gameId));
      if (player) {
        await socket.join(channels.matchPlayer(gameId, player.playerId));
        return this.matches.buildStateMessage(
          match,
          { type: 'player', playerId: player.playerId },
          players,
        );
      }
      await socket.join(channels.matchSpectators(gameId));
      return this.matches.buildStateMessage(match, { type: 'spectator' }, players);
    });
  }

  @SubscribeMessage(ClientEvents.GameAction)
  action(
    @ConnectedSocket() socket: AppSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<GameActionAccepted>> {
    return this.ack(async () => {
      if (!socket.data.actionLimiter.tryConsume()) {
        throw new AppError(ErrorCodes.RateLimited, 'Too many actions. Slow down.', 429);
      }
      const request = this.parse(gameActionSchema, body);
      return this.actions.execute({
        matchId: request.gameId,
        userId: socket.data.userId,
        requestId: request.requestId,
        expectedVersion: request.expectedVersion,
        action: request.action,
        now: new Date(),
      });
    });
  }

  @OnEvent(PlatformEvents.RoomUpdated)
  async onRoomUpdated(event: RoomUpdatedEvent): Promise<void> {
    const { room } = event;
    this.server.to(channels.room(event.roomId)).emit(ServerEvents.RoomUpdated, room);
    // Notify removed members once, then revoke every tab's room subscription.
    const memberIds = new Set(room.members.map((member) => member.userId));
    for (const socket of await this.server.in(channels.room(event.roomId)).fetchSockets()) {
      if (!memberIds.has(socket.data.userId as string)) {
        await socket.leave(channels.room(event.roomId));
      }
    }
    this.noticeLobby();
  }

  /** At once when the lobby has been quiet, otherwise once for everything since the last one. */
  private noticeLobby(): void {
    if (this.lobbyNoticeTimer) return;
    const wait = Math.max(0, this.lobbyNoticeAt + LOBBY_NOTICE_INTERVAL_MS - Date.now());
    this.lobbyNoticeTimer = setTimeout(() => {
      this.lobbyNoticeTimer = null;
      this.lobbyNoticeAt = Date.now();
      this.server.to(channels.lobby).emit(ServerEvents.LobbyChanged);
    }, wait);
  }

  /** The handshake only stops new connections; this ends the ones already open. */
  @OnEvent(PlatformEvents.UserDisabled)
  onUserDisabled(event: UserDisabledEvent): void {
    this.server.in(channels.user(event.userId)).disconnectSockets(true);
  }

  @OnEvent(PlatformEvents.MatchStarted)
  onMatchStarted(event: MatchStartedEvent): void {
    const message: GameStartedMessage = event;
    this.server.to(channels.room(event.roomId)).emit(ServerEvents.GameStarted, message);
  }

  /** Control handoffs do not advance the engine's action sequence. */
  @OnEvent(PlatformEvents.MatchControlChanged)
  async onMatchControlChanged(event: MatchStateChangedEvent): Promise<void> {
    const access = await this.matches.getSummaryForBroadcast(event.matchId);
    if (!access) return;
    this.server
      .to(channels.match(event.matchId))
      .emit(ServerEvents.GameAutoplay, this.matches.controlMessage(event.matchId, access.players));
  }

  /** Each player gets their own view; nobody is ever sent the raw state. */
  @OnEvent(PlatformEvents.MatchStateChanged)
  async onMatchStateChanged(event: MatchStateChangedEvent): Promise<void> {
    const access = event.snapshot ?? (await this.matches.getAccessForBroadcast(event.matchId));
    if (!access) return;
    const { match, players } = access;

    // A view is built and encoded only for a seat someone has open: not for computer players,
    // people who have put their phone down, or an empty gallery.
    for (const player of players) {
      const channel = channels.matchPlayer(match.id, player.playerId);
      if (!this.hasListeners(channel)) continue;
      this.server
        .to(channel)
        .emit(
          ServerEvents.GameState,
          this.matches.buildStateMessage(
            match,
            { type: 'player', playerId: player.playerId },
            players,
          ),
        );
    }
    const spectators = channels.matchSpectators(match.id);
    if (!this.hasListeners(spectators)) return;
    this.server
      .to(spectators)
      .emit(
        ServerEvents.GameState,
        this.matches.buildStateMessage(match, { type: 'spectator' }, players),
      );
  }

  private hasListeners(channel: string): boolean {
    return (this.server.sockets.adapter.rooms.get(channel)?.size ?? 0) > 0;
  }

  /**
   * Tells the table a match is over, however it ended. Separate from the state fan-out because
   * a match an administrator ends has no new state, and may be one the engine can no longer read.
   */
  @OnEvent(PlatformEvents.MatchFinished)
  async onMatchFinished(event: MatchFinishedEvent): Promise<void> {
    const access = await this.matches.getSummaryForBroadcast(event.matchId);
    const match = access?.match;
    if (!match || match.status === 'playing') return;
    const finished: GameFinishedMessage = {
      gameId: match.id,
      status: match.status,
      result: match.result ?? null,
    };
    this.server.to(channels.match(match.id)).emit(ServerEvents.GameFinished, finished);
  }

  private parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
    return parseWithSchema(schema, body);
  }

  private ack<T>(handler: () => Promise<T>): Promise<Ack<T>> {
    return toAck(this.logger, handler);
  }
}
