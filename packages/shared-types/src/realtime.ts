import type { ApiError } from './errors.js';
import type { MatchResultDto, PlayerAutoplayDto, RoomDto } from './rest.js';

export const ClientEvents = {
  RoomJoin: 'room.join',
  RoomLeave: 'room.leave',
  GameSync: 'game.sync',
  GameAction: 'game.action',
} as const;

export const ServerEvents = {
  RoomUpdated: 'room.updated',
  GameStarted: 'game.started',
  GameState: 'game.state',
  GameAutoplay: 'game.autoplay',
  GameActionAccepted: 'game.action.accepted',
  GameActionRejected: 'game.action.rejected',
  GameFinished: 'game.finished',
  PlayerConnected: 'player.connected',
  PlayerDisconnected: 'player.disconnected',
} as const;

/** Every client->server event is acknowledged with this envelope. */
export type Ack<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export interface RoomSubscriptionRequest {
  roomId: string;
}

export interface GameSyncRequest {
  gameId: string;
}

export interface GameActionRequest<TAction = unknown> {
  gameId: string;
  /** Client-generated UUID. Re-sending the same requestId never applies the action twice. */
  requestId: string;
  expectedVersion: number;
  action: TAction;
}

export interface GameStateMessage<TView = unknown> {
  gameId: string;
  gameType: string;
  version: number;
  status: 'playing' | 'finished' | 'abandoned';
  /** The viewer's player id, or null for spectators. */
  viewerPlayerId: string | null;
  /** Personalised view. Never the raw server state. */
  state: TView;
  /** Control metadata, not engine state. Absent in replay frames. */
  autoplay?: PlayerAutoplayDto[];
}

export interface GameAutoplayMessage {
  gameId: string;
  players: PlayerAutoplayDto[];
}

export interface GameActionAccepted {
  gameId: string;
  requestId: string;
  version: number;
  /** True when this requestId had already been applied. */
  duplicate: boolean;
}

export interface GameActionRejected {
  gameId: string;
  requestId: string;
  error: ApiError;
}

export interface GameStartedMessage {
  roomId: string;
  matchId: string;
  gameType: string;
}

export interface GameFinishedMessage {
  gameId: string;
  /** `abandoned` when an administrator ended it; there is then no result. */
  status: 'finished' | 'abandoned';
  result: MatchResultDto | null;
}

export interface PlayerPresenceMessage {
  gameId: string;
  playerId: string;
}

export type RoomUpdatedMessage = RoomDto;
