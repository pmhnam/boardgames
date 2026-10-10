export type UserRole = 'player' | 'admin';

export interface UserDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

export interface AuthSessionDto {
  accessToken: string;
  user: UserDto;
}

export interface GameDefinitionDto {
  gameType: string;
  displayName: string;
  minPlayers: number;
  maxPlayers: number;
  supportsBots: boolean;
  supportsSpectators: boolean;
  engineVersion: number;
}

/** One immutable version of a game's configuration. The newest version is the one in force. */
export interface GameConfigDto<TConfig = unknown> {
  gameType: string;
  version: number;
  /** Shaped and validated by that game's engine. */
  config: TConfig;
  note: string | null;
  createdAt: string;
}

/** A game as the admin area lists it: what it is, and which config version is in force. */
export interface AdminGameDto extends GameDefinitionDto {
  currentVersion: number;
  currentPublishedAt: string;
}

export interface ConfigAuthorDto {
  id: string;
  displayName: string;
}

/** A config version without its document, for listing a game's history. */
export interface GameConfigSummaryDto {
  gameType: string;
  version: number;
  note: string | null;
  createdAt: string;
  /** Null for versions the server wrote itself (the seed, or a reset after an engine upgrade). */
  createdBy: ConfigAuthorDto | null;
}

export interface AdminGameConfigDto<TConfig = unknown> extends GameConfigDto<TConfig> {
  createdBy: ConfigAuthorDto | null;
  /** Why the current engine refuses this document, or null when it still accepts it. */
  engineError: string | null;
}

export interface PublishGameConfigRequest<TConfig = unknown> {
  config: TConfig;
  /** Why the config changed. */
  note?: string;
  /** The version the edit started from. Publishing fails if a newer one exists by now. */
  expectedVersion: number;
}

/** Publishes an earlier version's document again, as the newest version. */
export interface RestoreGameConfigRequest {
  expectedVersion: number;
  note?: string;
}

export interface ValidateGameConfigRequest<TConfig = unknown> {
  config: TConfig;
}

/** A config as the engine reads it, with its defaults filled in. */
export interface GameConfigDocumentDto<TConfig = unknown> {
  config: TConfig;
}

/** What publishing a new config for a game would cost. */
export interface ConfigReplayImpactDto {
  /** Finished matches that can be replayed now and no longer could afterwards. */
  replayableMatches: number;
}

/** One page of an admin list. `total` counts every row the filters match. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** How strong a computer player is. */
export type BotLevel = 'easy' | 'normal' | 'hard';

export type RoomStatus = 'open' | 'in_match' | 'closed';
export type RoomVisibility = 'private' | 'public';
export type RoomMemberStatus = 'joined' | 'ready';

export interface RoomMemberDto {
  userId: string;
  displayName: string;
  seat: number;
  status: RoomMemberStatus;
  /** Set when this seat is a computer player. */
  botLevel: BotLevel | null;
}

export interface RoomDto {
  id: string;
  /** Short invite code. */
  code: string;
  gameType: string;
  hostUserId: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  /** What the host chose for matches in this room. Shaped by the game. */
  settings: Record<string, unknown>;
  members: RoomMemberDto[];
  /** The match currently being played in this room, if any. */
  currentMatchId: string | null;
  createdAt: string;
}

/** A room as the admin area lists it, whoever it belongs to and whether or not it is public. */
export interface AdminRoomDto extends RoomDto {
  hostDisplayName: string;
}

export type MatchStatus = 'playing' | 'finished' | 'abandoned';

export interface PlayerAutoplayDto {
  playerId: string;
  level: BotLevel | null;
  /** Independent of the game's action sequence. Increases on each control handoff. */
  version: number;
}

export interface MatchPlayerDto {
  playerId: string;
  userId: string;
  displayName: string;
  seat: number;
  /** Set when this player is a computer player. */
  botLevel: BotLevel | null;
  autoplayLevel: BotLevel | null;
  controlVersion: number;
}

export interface MatchResultDto {
  winnerPlayerIds: string[];
  scores?: Record<string, number>;
}

export interface MatchDto {
  id: string;
  roomId: string;
  gameType: string;
  engineVersion: number;
  /** The game config version this match was set up with. */
  configVersion: number;
  status: MatchStatus;
  version: number;
  players: MatchPlayerDto[];
  result: MatchResultDto | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** A match as the admin area lists it. Never carries game state. */
export interface AdminMatchDto extends MatchDto {
  roomCode: string;
  /** When the last move was made; null if nobody has moved yet. */
  lastActionAt: string | null;
  /** Saved by rules the server no longer runs, so it cannot be played on. */
  engineOutdated: boolean;
}

export interface MatchActionDto {
  sequence: number;
  playerId: string;
  actionType: string;
  payload: unknown;
  createdAt: string;
}

export interface MatchHistoryDto {
  match: MatchDto;
  actions: MatchActionDto[];
}

export interface ReplayFrameDto {
  version: number;
  /** Null for the initial frame. */
  action: MatchActionDto | null;
  /** Spectator view of the state after `action`. */
  state: unknown;
}

export interface MatchReplayDto {
  match: MatchDto;
  frames: ReplayFrameDto[];
}

export interface CreateRoomRequest {
  gameType: string;
  /** Game-specific choices, e.g. which map. Omitted means the game's defaults. */
  settings?: Record<string, unknown>;
  visibility?: RoomVisibility;
}

export interface GuestLoginRequest {
  displayName: string;
}

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface UpdateRoomSettingsRequest {
  settings: Record<string, unknown>;
}

export interface AddBotRequest {
  level: BotLevel;
}

export interface SetReadyRequest {
  ready: boolean;
}

export interface StartRoomResponse {
  room: RoomDto;
  matchId: string;
}

/** A user as the admin area lists them. */
export interface AdminUserDto {
  id: string;
  displayName: string;
  role: UserRole;
  isBot: boolean;
  /** When an administrator locked the account out, or null while it can sign in. */
  disabledAt: string | null;
  createdAt: string;
}

export interface AdminUserDetailDto {
  user: AdminUserDto;
  /** Rooms they have a seat in. */
  rooms: AdminRoomDto[];
  recentMatches: MatchDto[];
}

export interface SetUserDisabledRequest {
  disabled: boolean;
}
