import type { GameStateMessage, MatchPlayerDto } from '@bgp/shared-types';
import type { ComponentType } from 'react';

export interface GameViewProps<TView = unknown, TAction = unknown> {
  /** The server's latest personalised view of the match. */
  message: GameStateMessage<TView>;
  players: MatchPlayerDto[];
  /** Submit intent. The result arrives as a new `message`. */
  sendAction(action: TAction): void;
  /** True while an action is in flight, or when the view is read-only (replay). */
  disabled: boolean;
}

export interface GameUiDefinition {
  gameType: string;
  // Each game narrows the view/action types itself; the platform passes them through untyped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<GameViewProps<any, any>>;
}

export function playerName(players: MatchPlayerDto[], playerId: string): string {
  return players.find((player) => player.playerId === playerId)?.displayName ?? playerId;
}
