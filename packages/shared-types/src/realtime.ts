import type { ApiError } from './errors.js';
import type { MatchResultDto, PlayerAutoplayDto, RoomDto } from './rest.js';

export const ClientEvents = {
  LobbyJoin: 'lobby.join',
  LobbyLeave: 'lobby.leave',
  RoomJoin: 'room.join',
  RoomLeave: 'room.leave',
  GameSync: 'game.sync',
  GameAction: 'game.action',
  VoiceJoin: 'voice.join',
  VoiceLeave: 'voice.leave',
  VoiceSignal: 'voice.signal',
  VoiceMute: 'voice.mute',
} as const;

export const ServerEvents = {
  /** Carries nothing: the room list differs per person, so each fetches their own. */
  LobbyChanged: 'lobby.changed',
  RoomUpdated: 'room.updated',
  GameStarted: 'game.started',
  GameState: 'game.state',
  GameAutoplay: 'game.autoplay',
  GameFinished: 'game.finished',
  VoicePeerJoined: 'voice.peer-joined',
  VoicePeerLeft: 'voice.peer-left',
  VoicePeerMuted: 'voice.peer-muted',
  VoiceSignal: 'voice.signal',
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

export type RoomUpdatedMessage = RoomDto;

// Voice. The sound itself goes from browser to browser; the server only introduces them to
// each other, by passing on what each needs to say to the other to open that connection.

/** One open connection in a room's call. A person with two tabs in the call is two of these. */
export interface VoicePeer {
  /**
   * One browser's part in the call, named by that browser: what a signal is addressed to. It
   * outlives the socket it came in on, so a connection that drops and returns is the same peer.
   */
  peerId: string;
  userId: string;
  displayName: string;
  muted: boolean;
}

/** Where a browser asks how to reach another through whatever network sits between them. */
export interface VoiceIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface VoiceJoinRequest {
  roomId: string;
  /** Sent again after a reconnect to take the same place back. Without one, the socket's id. */
  peerId?: string;
}

export interface VoiceJoined {
  roomId: string;
  /** The joiner's own peer id. */
  peerId: string;
  /** Everyone already in the call. The joiner opens a connection to each of them. */
  peers: VoicePeer[];
  iceServers: VoiceIceServer[];
  /**
   * The place was still held from before a reconnect: the connections to the others may well
   * be alive, and only those to peers not yet connected need opening.
   */
  resumed?: boolean;
}

/** What two browsers exchange to open a connection: a session description or a candidate. */
export type VoiceSignal =
  | { description: { type: 'offer' | 'answer'; sdp: string } }
  | {
      /** Null once a side has no more to offer. */
      candidate: {
        candidate: string;
        sdpMid: string | null;
        sdpMLineIndex: number | null;
        usernameFragment?: string | null;
      } | null;
    };

export interface VoiceSignalRequest {
  roomId: string;
  toPeerId: string;
  signal: VoiceSignal;
}

export interface VoiceSignalMessage {
  roomId: string;
  fromPeerId: string;
  signal: VoiceSignal;
}

export interface VoiceMuteRequest {
  roomId: string;
  muted: boolean;
}

export interface VoicePeerMessage {
  roomId: string;
  peer: VoicePeer;
}

export interface VoicePeerLeftMessage {
  roomId: string;
  peerId: string;
}
