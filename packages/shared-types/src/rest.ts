export interface UserDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
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

export interface UpdateGameConfigRequest<TConfig = unknown> {
  config: TConfig;
  /** Why the config changed. */
  note?: string;
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

export type MatchStatus = 'playing' | 'finished' | 'abandoned';

export interface MatchPlayerDto {
  playerId: string;
  userId: string;
  displayName: string;
  seat: number;
  /** Set when this player is a computer player. */
  botLevel: BotLevel | null;
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
