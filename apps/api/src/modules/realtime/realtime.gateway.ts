import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
} from '@nestjs/websockets';
import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type GameActionAccepted,
  type GameActionRejected,
  type GameFinishedMessage,
  type GameStartedMessage,
  type GameStateMessage,
  type PlayerPresenceMessage,
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
} from '../../common/events/platform-events.js';
import { toApiError } from '../../common/filters/app-exception.filter.js';
import { parseWithSchema } from '../../common/pipes/zod-validation.pipe.js';
import { AuthService } from '../auth/auth.service.js';
import { GameActionService } from '../matches/game-action.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { RateLimiter } from './rate-limiter.js';
import { gameActionSchema, gameSyncSchema, roomSubscriptionSchema } from './realtime.schemas.js';

interface SocketData {
  /** Set once, from the verified handshake token. */
  userId: string;
  actionLimiter: RateLimiter;
  /** matchId -> the player this socket is seated as. */
  seats: Map<string, string>;
}

type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>;

const ACTION_BURST = 20;
const ACTIONS_PER_SECOND = 5;

const channels = {
  room: (roomId: string) => `room:${roomId}`,
  match: (matchId: string) => `match:${matchId}`,
  matchPlayer: (matchId: string, playerId: string) => `match:${matchId}:player:${playerId}`,
  matchSpectators: (matchId: string) => `match:${matchId}:spectators`,
};

/**
 * Transport only: authenticate, validate shapes, delegate, relay. No game or room rules here.
 */
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

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
        .then((userId) => {
          socket.data.userId = userId;
          socket.data.actionLimiter = new RateLimiter(ACTION_BURST, ACTIONS_PER_SECOND);
          socket.data.seats = new Map();
          next();
        })
        .catch(() => next(new Error(ErrorCodes.Unauthorized)));
    });
  }

  handleConnection(socket: AppSocket): void {
    this.logger.debug(`socket connected user=${socket.data.userId}`);
  }

  handleDisconnect(socket: AppSocket): void {
    for (const [gameId, playerId] of socket.data.seats ?? []) {
      void this.emitPresence(ServerEvents.PlayerDisconnected, gameId, playerId);
    }
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
        if (!socket.data.seats.has(gameId)) {
          socket.data.seats.set(gameId, player.playerId);
          const presence: PlayerPresenceMessage = { gameId, playerId: player.playerId };
          socket.to(channels.match(gameId)).emit(ServerEvents.PlayerConnected, presence);
        }
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
  async action(
    @ConnectedSocket() socket: AppSocket,
    @MessageBody() body: unknown,
  ): Promise<Ack<GameActionAccepted>> {
    const result = await this.ack(async () => {
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

    if (result.ok) {
      socket.emit(ServerEvents.GameActionAccepted, result.data);
    } else {
      const ids = body as { gameId?: unknown; requestId?: unknown } | null;
      const rejected: GameActionRejected = {
        gameId: typeof ids?.gameId === 'string' ? ids.gameId : '',
        requestId: typeof ids?.requestId === 'string' ? ids.requestId : '',
        error: result.error,
      };
      socket.emit(ServerEvents.GameActionRejected, rejected);
    }
    return result;
  }

  @OnEvent(PlatformEvents.RoomUpdated)
  async onRoomUpdated(event: RoomUpdatedEvent): Promise<void> {
    const room = await this.rooms.getDto(event.roomId);
    this.server.to(channels.room(event.roomId)).emit(ServerEvents.RoomUpdated, room);
  }

  @OnEvent(PlatformEvents.MatchStarted)
  onMatchStarted(event: MatchStartedEvent): void {
    const message: GameStartedMessage = event;
    this.server.to(channels.room(event.roomId)).emit(ServerEvents.GameStarted, message);
  }

  /** Control handoffs do not advance the engine's action sequence. */
  @OnEvent(PlatformEvents.MatchControlChanged)
  async onMatchControlChanged(event: MatchStateChangedEvent): Promise<void> {
    const access = await this.matches.getAccessForBroadcast(event.matchId);
    if (!access) return;
    this.server
      .to(channels.match(event.matchId))
      .emit(ServerEvents.GameAutoplay, this.matches.controlMessage(event.matchId, access.players));
  }

  /** Each player gets their own view; nobody is ever sent the raw state. */
  @OnEvent(PlatformEvents.MatchStateChanged)
  async onMatchStateChanged(event: MatchStateChangedEvent): Promise<void> {
    const access = await this.matches.getAccessForBroadcast(event.matchId);
    if (!access) return;
    const { match, players } = access;

    for (const player of players) {
      this.server
        .to(channels.matchPlayer(match.id, player.playerId))
        .emit(
          ServerEvents.GameState,
          this.matches.buildStateMessage(
            match,
            { type: 'player', playerId: player.playerId },
            players,
          ),
        );
    }
    this.server
      .to(channels.matchSpectators(match.id))
      .emit(
        ServerEvents.GameState,
        this.matches.buildStateMessage(match, { type: 'spectator' }, players),
      );

    if (match.status === 'finished') {
      const finished: GameFinishedMessage = { gameId: match.id, result: match.result ?? null };
      this.server.to(channels.match(match.id)).emit(ServerEvents.GameFinished, finished);
    }
  }

  /** Only reports a player gone when their last socket for that match has closed. */
  private async emitPresence(
    event: typeof ServerEvents.PlayerDisconnected,
    gameId: string,
    playerId: string,
  ): Promise<void> {
    const remaining = await this.server.in(channels.matchPlayer(gameId, playerId)).fetchSockets();
    if (remaining.length > 0) return;
    const presence: PlayerPresenceMessage = { gameId, playerId };
    this.server.to(channels.match(gameId)).emit(event, presence);
  }

  private parse<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
    return parseWithSchema(schema, body);
  }

  private async ack<T>(handler: () => Promise<T>): Promise<Ack<T>> {
    try {
      return { ok: true, data: await handler() };
    } catch (error) {
      const { status, error: apiError } = toApiError(error);
      if (status >= 500) this.logger.error(error instanceof Error ? error.stack : error);
      return { ok: false, error: apiError };
    }
  }
}
