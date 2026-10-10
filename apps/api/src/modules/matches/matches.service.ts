import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AnyGameEngine, GameViewer, PlayerSeat } from '@bgp/game-core';
import {
  ErrorCodes,
  type AdminMatchDto,
  type BotLevel,
  type ConfigReplayImpactDto,
  type GameStateMessage,
  type MatchDto,
  type MatchHistoryDto,
  type MatchReplayDto,
  type Page,
  type GameAutoplayMessage,
  type PlayerAutoplayDto,
  type ReplayFrameDto,
} from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import { PlatformEvents } from '../../common/events/platform-events.js';
import type { OpaqueGameState } from '../../infrastructure/database/schema.js';
import { GameConfigService } from '../games/game-config.service.js';
import { GameRegistry } from '../games/game-registry.js';
import { toMatchActionDto, toMatchDto } from './match.mapper.js';
import {
  MatchRepository,
  type MatchListFilter,
  type MatchPlayerRecord,
  type MatchRecord,
  type MatchSummaryRecord,
} from './match.repository.js';

export interface MatchAccess {
  match: MatchRecord;
  players: MatchPlayerRecord[];
  /** The requesting user's seat, or null when they are watching. */
  player: MatchPlayerRecord | null;
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly matches: MatchRepository,
    private readonly registry: GameRegistry,
    private readonly configs: GameConfigService,
    private readonly events: EventEmitter2,
  ) {}

  /** Turns a room's seated members into a new match. Seat N becomes player `p{N+1}`. */
  async createForRoom(input: {
    roomId: string;
    gameType: string;
    /** As stored on the room. Checked again here: the config may have changed since. */
    settings: Record<string, unknown>;
    members: Array<{ userId: string; seat: number; botLevel: BotLevel | null }>;
  }): Promise<string> {
    const { engine } = this.registry.get(input.gameType);
    const current = await this.configs.getCurrentForPlay(input.gameType);
    const settings = this.parseSettings(engine, input.settings, current.config);
    const setup = engine.validateSetup?.({
      config: current.config,
      settings,
      playerCount: input.members.length,
    });
    if (setup && !setup.valid) {
      throw new AppError(ErrorCodes.InvalidRoomSettings, setup.message, 409, { rule: setup.code });
    }
    const matchId = randomUUID();
    const seed = randomUUID();
    const now = new Date();

    const players = [...input.members]
      .sort((a, b) => a.seat - b.seat)
      .map((member, index) => ({
        userId: member.userId,
        seat: index,
        playerId: `p${index + 1}`,
        botLevel: member.botLevel,
      }));
    const seats: PlayerSeat[] = players.map(({ playerId, seat }) => ({ playerId, seat }));

    const state: OpaqueGameState = engine.createInitialState({
      gameId: matchId,
      players: seats,
      seed,
      config: current.config,
      settings,
    });

    await this.matches.create({
      match: {
        id: matchId,
        roomId: input.roomId,
        gameType: input.gameType,
        engineVersion: engine.engineVersion,
        configVersion: current.version,
        settings,
        status: 'playing',
        state,
        stateVersion: 0,
        randomSeed: seed,
        createdAt: now,
        startedAt: now,
      },
      players,
    });

    return matchId;
  }

  /** Loads a match and decides whether the user may see it at all. */
  async getAccess(matchId: string, userId: string): Promise<MatchAccess> {
    const match = await this.matches.findById(matchId);
    if (!match) throw new AppError(ErrorCodes.MatchNotFound, 'Match not found.', 404);

    const players = await this.matches.listPlayers(matchId);
    const player = players.find((candidate) => candidate.userId === userId) ?? null;

    if (!player && !this.registry.get(match.gameType).definition.supportsSpectators) {
      throw new AppError(ErrorCodes.Forbidden, 'You are not a player in this match.', 403);
    }
    return { match, players, player };
  }

  /** For server-initiated fan-out, where there is no requesting user. */
  async getAccessForBroadcast(
    matchId: string,
  ): Promise<{ match: MatchRecord; players: MatchPlayerRecord[] } | null> {
    const match = await this.matches.findById(matchId);
    if (!match) return null;
    return { match, players: await this.matches.listPlayers(matchId) };
  }

  async getMatch(matchId: string, userId: string): Promise<MatchDto> {
    const { match, players } = await this.getAccess(matchId, userId);
    return toMatchDto(match, players);
  }

  async getStateMessage(matchId: string, userId: string): Promise<GameStateMessage> {
    const { match, player, players } = await this.getAccess(matchId, userId);
    return this.buildStateMessage(
      match,
      player ? { type: 'player', playerId: player.playerId } : { type: 'spectator' },
      players,
    );
  }

  /** The only path by which game state leaves the server: always through the engine's view. */
  buildStateMessage(
    match: MatchRecord,
    viewer: GameViewer,
    players: MatchPlayerRecord[] = [],
  ): GameStateMessage {
    const { engine } = this.registry.getForMatch(match);
    return {
      gameId: match.id,
      gameType: match.gameType,
      version: match.stateVersion,
      status: match.status,
      viewerPlayerId: viewer.type === 'player' ? viewer.playerId : null,
      state: engine.getPublicView(match.state, viewer),
      autoplay: this.controlMessage(match.id, players).players,
    };
  }

  controlMessage(gameId: string, players: MatchPlayerRecord[]): GameAutoplayMessage {
    return {
      gameId,
      players: players.map((player) => ({
        playerId: player.playerId,
        level: player.autoplayLevel,
        version: player.controlVersion,
      })),
    };
  }

  async setAutoplay(matchId: string, userId: string, enabled: boolean): Promise<PlayerAutoplayDto> {
    const { match, player } = await this.getAccess(matchId, userId);
    if (!player || player.botLevel !== null)
      throw new AppError(ErrorCodes.Forbidden, 'You can only control your own human seat.', 403);
    const game = this.registry.getForMatch(match);
    if (!game.bot)
      throw new AppError(ErrorCodes.BotsNotSupported, 'This game does not support bots.', 409);
    const control = await this.matches.setAutoplay(matchId, userId, enabled);
    await this.events.emitAsync(PlatformEvents.MatchControlChanged, { matchId });
    return control;
  }

  async listForUser(userId: string): Promise<MatchDto[]> {
    const records = await this.matches.listForUser(userId);
    const players = await this.matches.listPlayersForMatches(records.map((match) => match.id));
    return records.map((match) => toMatchDto(match, players.get(match.id) ?? []));
  }

  async getHistory(matchId: string, userId: string): Promise<MatchHistoryDto> {
    const { match, players } = await this.getFinished(matchId, userId);
    const actions = await this.matches.listActions(matchId);
    return { match: toMatchDto(match, players), actions: actions.map(toMatchActionDto) };
  }

  /** Rebuilds every state from the seed and the action log. */
  async getReplay(matchId: string, userId: string): Promise<MatchReplayDto> {
    const { match, players } = await this.getFinished(matchId, userId);
    const { engine } = this.registry.get(match.gameType);
    if (engine.engineVersion !== match.engineVersion) {
      throw new AppError(
        ErrorCodes.ReplayUnavailable,
        'The rules of this game have changed since this match was played, so it can no longer be replayed.',
        409,
        { matchEngineVersion: match.engineVersion, currentEngineVersion: engine.engineVersion },
      );
    }
    // A replay re-runs setup, and setup depends on the config. Only the current one is used.
    const current = await this.configs.getCurrentForPlay(match.gameType);
    if (current.version !== match.configVersion) {
      throw new AppError(
        ErrorCodes.ReplayUnavailable,
        'The configuration of this game has changed since this match was played, so it can no longer be replayed.',
        409,
        { matchConfigVersion: match.configVersion, currentConfigVersion: current.version },
      );
    }

    const spectator: GameViewer = { type: 'spectator' };
    let state: OpaqueGameState = engine.createInitialState({
      gameId: match.id,
      players: players.map(({ playerId, seat }) => ({ playerId, seat })),
      seed: match.randomSeed,
      config: current.config,
      settings: this.parseSettings(engine, match.settings, current.config),
    });
    const frames: ReplayFrameDto[] = [
      { version: 0, action: null, state: engine.getPublicView(state, spectator) },
    ];

    for (const action of await this.matches.listActions(matchId)) {
      state = engine.applyAction(state, action.payload, {
        actorPlayerId: action.playerId,
        requestId: action.requestId,
        now: action.createdAt.toISOString(),
      });
      frames.push({
        version: action.sequence,
        action: toMatchActionDto(action),
        state: engine.getPublicView(state, spectator),
      });
    }

    return { match: toMatchDto(match, players), frames };
  }

  /** Every kept match, whoever is playing it. Describes matches; never shows their state. */
  async listForAdmin(
    filter: MatchListFilter,
    page: { limit: number; offset: number },
  ): Promise<Page<AdminMatchDto>> {
    const [records, total] = await Promise.all([
      this.matches.listPage(filter, page),
      this.matches.countPage(filter),
    ]);
    return { items: await this.toAdminDtos(records), total, ...page };
  }

  async getForAdmin(matchId: string): Promise<AdminMatchDto> {
    const record = await this.matches.findSummary(matchId);
    if (!record) throw new AppError(ErrorCodes.MatchNotFound, 'Match not found.', 404);
    const [dto] = await this.toAdminDtos([record]);
    return dto!;
  }

  private async toAdminDtos(records: MatchSummaryRecord[]): Promise<AdminMatchDto[]> {
    const ids = records.map((record) => record.id);
    const [players, lastActionAt] = await Promise.all([
      this.matches.listPlayersForMatches(ids),
      this.matches.lastActionAt(ids),
    ]);
    const engineVersions = new Map(
      this.registry.list().map((game) => [game.definition.gameType, game.engine.engineVersion]),
    );
    return records.map((record) => ({
      ...toMatchDto(record, players.get(record.id) ?? []),
      roomCode: record.roomCode,
      lastActionAt: lastActionAt.get(record.id)?.toISOString() ?? null,
      engineOutdated: engineVersions.get(record.gameType) !== record.engineVersion,
    }));
  }

  /**
   * A replay needs the config its match was set up with to still be the current one, so
   * publishing a new config ends replay for every match counted here.
   */
  async replayImpact(gameType: string): Promise<ConfigReplayImpactDto> {
    const { engine } = this.registry.get(gameType);
    const configVersion = await this.configs.getCurrentVersion(gameType);
    const replayableMatches = await this.matches.countEnded({
      gameType,
      configVersion,
      engineVersion: engine.engineVersion,
    });
    return { replayableMatches };
  }

  private parseSettings(
    engine: AnyGameEngine,
    raw: Record<string, unknown>,
    config: unknown,
  ): Record<string, unknown> {
    const parsed = engine.parseSettings(raw, config);
    if (!parsed.ok) {
      throw new AppError(
        ErrorCodes.InvalidRoomSettings,
        `This room's settings no longer fit the game's configuration: ${parsed.message}`,
        409,
      );
    }
    return parsed.settings as Record<string, unknown>;
  }

  /** Action logs can reveal hidden information, so they are only served once a match is over. */
  private async getFinished(matchId: string, userId: string): Promise<MatchAccess> {
    const access = await this.getAccess(matchId, userId);
    if (access.match.status === 'playing') {
      throw new AppError(
        ErrorCodes.MatchNotFinished,
        'History is available once the match has finished.',
        409,
      );
    }
    return access;
  }
}
