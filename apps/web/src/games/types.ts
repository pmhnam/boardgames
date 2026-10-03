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

export type RoomSettings = Record<string, unknown>;

export interface SettingsFormProps<TConfig = unknown> {
  /** The game's current config: the options on offer come from here. */
  config: TConfig;
  /** What the host has picked so far. Empty means the game's defaults. */
  value: RoomSettings;
  onChange(value: RoomSettings): void;
}

export interface GameUiDefinition {
  gameType: string;
  /** Shown in the lobby before a room is created, for games with something to choose. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SettingsForm?: ComponentType<SettingsFormProps<any>>;
  /** One line describing a room's settings, e.g. the chosen map. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  describeSettings?(settings: RoomSettings, config: any): string | null;
  // Each game narrows the view/action types itself; the platform passes them through untyped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<GameViewProps<any, any>>;
}

export function playerName(players: MatchPlayerDto[], playerId: string): string {
  return players.find((player) => player.playerId === playerId)?.displayName ?? playerId;
}
