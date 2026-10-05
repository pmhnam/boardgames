import type { GameStateMessage, MatchPlayerDto } from '@bgp/shared-types';
import type { ComponentType } from 'react';
import type { Locale } from '../shared/i18n/locales';

export interface GameViewProps<TView = unknown, TAction = unknown> {
  /** The server's latest personalised view of the match. */
  message: GameStateMessage<TView>;
  players: MatchPlayerDto[];
  /** Submit intent. The result arrives as a new `message`. */
  sendAction(action: TAction): void;
  /** True while an action is in flight, or when the view is read-only (replay). */
  disabled: boolean;
  /** Live match control only; absent for spectators and replays. */
  autoplay?: {
    enabled: boolean;
    pending: boolean;
    error: string | null;
    toggle(): void;
  };
}

export type RoomSettings = Record<string, unknown>;

export interface SettingsFormProps<TConfig = unknown> {
  /** The game's current config: the options on offer come from here. */
  config: TConfig;
  /** What the host has picked so far. Empty means the game's defaults. */
  value: RoomSettings;
  onChange(value: RoomSettings): void;
  /** How many are seated in the room. Absent in the lobby, before the room exists. */
  playerCount?: number;
}

/** How a game presents itself in the lobby, before anyone is playing it. */
export interface GameCardMeta {
  /** An emoji standing in for box art. */
  icon: string;
  /** Hue (0–360) the card is tinted with. The stylesheet picks the shades for light and dark. */
  hue: number;
  /** One line on what the game is. */
  tagline: Record<Locale, string>;
  /** Demo games are listed after the real ones. */
  demo?: boolean;
}

export interface GameUiDefinition {
  gameType: string;
  /** Left out, the lobby falls back to the game's initial on a neutral card. */
  card?: GameCardMeta;
  /** Shown in the lobby before a room is created, for games with something to choose. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SettingsForm?: ComponentType<SettingsFormProps<any>>;
  /** One line describing a room's settings, e.g. the chosen map, in the viewer's language. */
  describeSettings?(
    settings: RoomSettings,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: any,
    playerCount: number | undefined,
    locale: Locale,
  ): string | null;
  /**
   * For games where several players act at once: an action refused only because someone else
   * got in first is sent again on the fresh state. The server still judges whether it is legal.
   */
  resendOnConflict?: boolean;
  /** Lets a seated player hand control to the server's bot. */
  supportsAutoplay?: boolean;
  // Each game narrows the view/action types itself; the platform passes them through untyped.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<GameViewProps<any, any>>;
}

export function playerName(players: MatchPlayerDto[], playerId: string): string {
  return players.find((player) => player.playerId === playerId)?.displayName ?? playerId;
}
