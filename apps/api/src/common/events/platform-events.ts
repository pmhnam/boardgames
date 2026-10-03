/** In-process domain events. Consumers (realtime today; analytics, ranking later) subscribe. */
export const PlatformEvents = {
  RoomUpdated: 'room.updated',
  MatchStarted: 'match.started',
  MatchStateChanged: 'match.state-changed',
  MatchFinished: 'match.finished',
} as const;

export interface RoomUpdatedEvent {
  roomId: string;
}

export interface MatchStartedEvent {
  roomId: string;
  matchId: string;
  gameType: string;
}

export interface MatchStateChangedEvent {
  matchId: string;
}

export interface MatchFinishedEvent {
  matchId: string;
  roomId: string;
}
