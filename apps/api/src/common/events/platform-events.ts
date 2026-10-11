import type { RoomDto } from '@bgp/shared-types';
import type { MatchSnapshot } from '../../modules/matches/match.repository.js';

/** In-process domain events. Consumers (realtime today; analytics, ranking later) subscribe. */
export const PlatformEvents = {
  RoomUpdated: 'room.updated',
  MatchStarted: 'match.started',
  MatchStateChanged: 'match.state-changed',
  MatchControlChanged: 'match.control-changed',
  MatchFinished: 'match.finished',
  UserDisabled: 'user.disabled',
} as const;

export interface RoomUpdatedEvent {
  roomId: string;
  /** The room as it now stands, so that no listener has to read it back. */
  room: RoomDto;
}

export interface MatchStartedEvent {
  roomId: string;
  matchId: string;
  gameType: string;
}

export interface MatchStateChangedEvent {
  matchId: string;
  /**
   * What was just saved, when the one who saved it has it at hand: it spares every listener
   * reading it back. Never leaves the process. Without it, a listener loads the match itself.
   */
  snapshot?: MatchSnapshot;
}

export interface MatchFinishedEvent {
  matchId: string;
  roomId: string;
}

export interface UserDisabledEvent {
  userId: string;
}
