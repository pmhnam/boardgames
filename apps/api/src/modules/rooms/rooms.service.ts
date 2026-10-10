import { randomInt, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  ErrorCodes,
  type AdminRoomDto,
  type BotLevel,
  type Page,
  type RoomDto,
  type RoomVisibility,
  type StartRoomResponse,
} from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import {
  PlatformEvents,
  type MatchFinishedEvent,
  type MatchStartedEvent,
  type RoomUpdatedEvent,
} from '../../common/events/platform-events.js';
import { uniqueViolationConstraint } from '../../infrastructure/database/pg-errors.js';
import { GameConfigService } from '../games/game-config.service.js';
import { GameRegistry } from '../games/game-registry.js';
import { MatchesService } from '../matches/matches.service.js';
import { UsersRepository } from '../users/users.repository.js';
import {
  RoomsRepository,
  type RoomListFilter,
  type RoomMemberRecord,
  type RoomRecord,
  type RoomWithHost,
} from './rooms.repository.js';

// No 0/O/1/I: codes get read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

const LOBBY_ROOM_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LOBBY_ROOM_LIMIT = 100;

const BOT_LEVEL_NAMES: Record<BotLevel, string> = { easy: 'Dễ', normal: 'Thường', hard: 'Khó' };

function generateRoomCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('');
}

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    private readonly rooms: RoomsRepository,
    private readonly users: UsersRepository,
    private readonly registry: GameRegistry,
    private readonly configs: GameConfigService,
    private readonly matches: MatchesService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    userId: string,
    input: { gameType: string; visibility: RoomVisibility; settings?: Record<string, unknown> },
  ): Promise<RoomDto> {
    const { engine } = this.registry.get(input.gameType);
    const current = await this.configs.getCurrentForPlay(input.gameType);
    const parsed = engine.parseSettings(input.settings, current.config);
    if (!parsed.ok) throw new AppError(ErrorCodes.InvalidRoomSettings, parsed.message, 400);

    const id = randomUUID();
    await this.rooms.create({
      id,
      code: generateRoomCode(),
      gameType: input.gameType,
      hostUserId: userId,
      status: 'open',
      visibility: input.visibility,
      settings: parsed.settings,
    });
    return this.getDto(id);
  }

  /**
   * The rooms a person can see from the lobby: public ones, and any they are a member of.
   * Rooms older than a day are left out unless they have an ongoing match to resume.
   */
  async listForLobby(userId: string): Promise<RoomDto[]> {
    const createdAfter = new Date(Date.now() - LOBBY_ROOM_MAX_AGE_MS);
    const listed: RoomDto[] = [];
    for (const room of await this.rooms.listActive(createdAfter, LOBBY_ROOM_LIMIT)) {
      const members = await this.rooms.listMembers(room.id);
      const isMember = members.some((member) => member.userId === userId);
      if (room.visibility === 'public' || isMember) listed.push(await this.toDto(room, members));
    }
    return listed;
  }

  async getDto(roomId: string): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    return this.toDto(room, await this.rooms.listMembers(room.id));
  }

  async getByCode(code: string): Promise<RoomDto> {
    const room = await this.rooms.findByCode(code.toUpperCase());
    if (!room) throw new AppError(ErrorCodes.RoomNotFound, 'Room not found.', 404);
    return this.toDto(room, await this.rooms.listMembers(room.id));
  }

  async isMember(roomId: string, userId: string): Promise<boolean> {
    const members = await this.rooms.listMembers(roomId);
    return members.some((member) => member.userId === userId);
  }

  async join(roomId: string, userId: string): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    const members = await this.rooms.listMembers(roomId);
    if (members.some((member) => member.userId === userId)) return this.toDto(room, members);

    this.requireOpen(room);
    const { maxPlayers } = this.registry.get(room.gameType).definition;
    const seat = this.findFreeSeat(members, maxPlayers);

    try {
      await this.rooms.addMember(roomId, userId, seat);
    } catch (error) {
      // Someone else took the seat between our read and our insert.
      if (uniqueViolationConstraint(error) !== null) {
        throw new AppError(ErrorCodes.RoomFull, 'That seat was just taken. Try again.', 409);
      }
      throw error;
    }
    return this.changed(roomId);
  }

  async leave(roomId: string, userId: string): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    const members = await this.requireMember(roomId, userId);
    this.requireOpen(room);

    await this.removeAndRebalance(room, members, userId);
    return this.changed(roomId);
  }

  /** Every room there is, for the admin area: private and closed ones included. */
  async listForAdmin(
    filter: RoomListFilter,
    page: { limit: number; offset: number },
  ): Promise<Page<AdminRoomDto>> {
    const [records, total] = await Promise.all([
      this.rooms.listPage(filter, page),
      this.rooms.countPage(filter),
    ]);
    return { items: await this.toAdminDtos(records), total, ...page };
  }

  async getForAdmin(roomId: string): Promise<AdminRoomDto> {
    const room = await this.rooms.findWithHost(roomId);
    if (!room) throw new AppError(ErrorCodes.RoomNotFound, 'Room not found.', 404);
    const [dto] = await this.toAdminDtos([room]);
    return dto!;
  }

  /** The rooms someone has a seat in, as the admin area shows them. */
  async listForMember(userId: string): Promise<AdminRoomDto[]> {
    return this.toAdminDtos(await this.rooms.listForMember(userId));
  }

  /**
   * An administrator takes someone out of a room, host or not. What follows is what follows
   * anyone leaving: the next person hosts, and a room with no people left closes.
   */
  async adminRemoveMember(
    roomId: string,
    memberUserId: string,
    byUserId: string,
  ): Promise<AdminRoomDto> {
    const room = await this.requireRoom(roomId);
    this.requireNotInMatch(room);
    this.requireOpen(room);
    const members = await this.rooms.listMembers(roomId);
    if (!members.some((member) => member.userId === memberUserId)) {
      throw new AppError(ErrorCodes.NotRoomMember, 'There is no such player here.', 404);
    }
    await this.removeAndRebalance(room, members, memberUserId);
    this.logger.log({ event: 'room_member_removed', roomId, userId: memberUserId, byUserId });
    await this.changed(roomId);
    return this.getForAdmin(roomId);
  }

  /** An administrator closes a room for good and empties it. Closing a closed room is a no-op. */
  async adminClose(roomId: string, byUserId: string): Promise<AdminRoomDto> {
    const outcome = await this.rooms.closeAndClear(roomId);
    if (outcome === 'not_found') {
      throw new AppError(ErrorCodes.RoomNotFound, 'Room not found.', 404);
    }
    if (outcome === 'in_match') this.requireNotInMatch({ status: 'in_match' });
    if (outcome === 'closed') {
      this.logger.log({ event: 'room_closed', roomId, byUserId });
      await this.changed(roomId);
    }
    return this.getForAdmin(roomId);
  }

  /** Takes a member out and keeps the room sound: a person hosting, or closed if none is left. */
  private async removeAndRebalance(
    room: RoomRecord,
    members: RoomMemberRecord[],
    userId: string,
  ): Promise<void> {
    await this.rooms.removeMember(room.id, userId);
    const remaining = members.filter((member) => member.userId !== userId);
    // Only a person can host. A room with nobody but computer players left is closed.
    const nextHost = remaining.find((member) => member.botLevel === null);
    if (!nextHost) {
      for (const bot of remaining) await this.rooms.removeMember(room.id, bot.userId);
      await this.rooms.update(room.id, { status: 'closed' });
    } else if (room.hostUserId === userId) {
      await this.rooms.update(room.id, { hostUserId: nextHost.userId });
    }
  }

  private async toAdminDtos(records: RoomWithHost[]): Promise<AdminRoomDto[]> {
    const ids = records.map((record) => record.id);
    const [members, currentMatches] = await Promise.all([
      this.rooms.listMembersForRooms(ids),
      this.rooms.findCurrentMatchIds(ids),
    ]);
    return records.map((room) => ({
      id: room.id,
      code: room.code,
      gameType: room.gameType,
      hostUserId: room.hostUserId,
      hostDisplayName: room.hostDisplayName,
      status: room.status,
      visibility: room.visibility,
      settings: room.settings,
      members: members.get(room.id) ?? [],
      currentMatchId: room.status === 'in_match' ? (currentMatches.get(room.id) ?? null) : null,
      createdAt: room.createdAt.toISOString(),
    }));
  }

  async kick(roomId: string, userId: string, memberUserId: string): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    const members = await this.requireMember(roomId, userId);
    this.requireOpen(room);
    this.requireHost(room, userId, 'Only the host can kick players.');

    if (memberUserId === userId) {
      throw new AppError(ErrorCodes.Forbidden, 'The host cannot kick themselves.', 403);
    }
    if (!members.some((member) => member.userId === memberUserId)) {
      throw new AppError(ErrorCodes.NotRoomMember, 'There is no such player here.', 404);
    }
    await this.rooms.removeMember(roomId, memberUserId);
    return this.changed(roomId);
  }

  /** Seats a computer player. It is a member like any other, and is always ready. */
  async addBot(roomId: string, userId: string, level: BotLevel): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    const members = await this.requireMember(roomId, userId);
    this.requireOpen(room);
    this.requireHost(room, userId, 'Only the host can add computer players.');

    const game = this.registry.get(room.gameType);
    if (!game.bot) {
      throw new AppError(
        ErrorCodes.BotsNotSupported,
        'This game cannot be played against the computer.',
        409,
      );
    }
    const seat = this.findFreeSeat(members, game.definition.maxPlayers);

    const botNumber = members.filter((member) => member.botLevel !== null).length + 1;
    const bot = await this.users.create({
      id: randomUUID(),
      displayName: `Bot ${BOT_LEVEL_NAMES[level]} ${botNumber}`,
      isBot: true,
    });
    try {
      await this.rooms.addMember(roomId, bot.id, seat, level);
    } catch (error) {
      if (uniqueViolationConstraint(error) !== null) {
        throw new AppError(ErrorCodes.RoomFull, 'That seat was just taken. Try again.', 409);
      }
      throw error;
    }
    return this.changed(roomId);
  }

  async removeBot(roomId: string, userId: string, botUserId: string): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    const members = await this.requireMember(roomId, userId);
    this.requireOpen(room);
    this.requireHost(room, userId, 'Only the host can remove computer players.');

    const bot = members.find((member) => member.userId === botUserId);
    if (!bot || bot.botLevel === null) {
      throw new AppError(ErrorCodes.NotRoomMember, 'There is no such computer player here.', 404);
    }
    await this.rooms.removeMember(roomId, botUserId);
    return this.changed(roomId);
  }

  async setReady(roomId: string, userId: string, ready: boolean): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    await this.requireMember(roomId, userId);
    this.requireOpen(room);
    await this.rooms.setMemberStatus(roomId, userId, ready ? 'ready' : 'joined');
    return this.changed(roomId);
  }

  /**
   * The host changes what the room will play (for Harmonies, the map). Everyone agreed to the
   * old settings, so people have to say they are ready again.
   */
  async updateSettings(
    roomId: string,
    userId: string,
    rawSettings: Record<string, unknown>,
  ): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    await this.requireMember(roomId, userId);
    this.requireOpen(room);
    this.requireHost(room, userId, 'Only the host can change the room settings.');

    const { engine } = this.registry.get(room.gameType);
    const current = await this.configs.getCurrentForPlay(room.gameType);
    const parsed = engine.parseSettings(rawSettings, current.config);
    if (!parsed.ok) throw new AppError(ErrorCodes.InvalidRoomSettings, parsed.message, 400);

    await this.rooms.update(roomId, { settings: parsed.settings });
    await this.rooms.resetMemberStatuses(roomId, 'joined');
    return this.changed(roomId);
  }

  async start(roomId: string, userId: string): Promise<StartRoomResponse> {
    const room = await this.requireRoom(roomId);
    const members = await this.requireMember(roomId, userId);
    this.requireOpen(room);

    this.requireHost(room, userId, 'Only the host can start the match.');
    const { minPlayers } = this.registry.get(room.gameType).definition;
    if (members.length < minPlayers) {
      throw new AppError(
        ErrorCodes.NotEnoughPlayers,
        `This game needs at least ${minPlayers} players.`,
        409,
      );
    }
    if (members.some((member) => member.status !== 'ready')) {
      throw new AppError(ErrorCodes.PlayersNotReady, 'Every player must be ready.', 409);
    }

    const matchId = await this.matches.createForRoom({
      roomId,
      gameType: room.gameType,
      settings: room.settings,
      members: members.map(({ userId: memberId, seat, botLevel }) => ({
        userId: memberId,
        seat,
        botLevel,
      })),
    });
    await this.rooms.update(roomId, { status: 'in_match' });

    const dto = await this.changed(roomId);
    const started: MatchStartedEvent = { roomId, matchId, gameType: room.gameType };
    await this.events.emitAsync(PlatformEvents.MatchStarted, started);
    return { room: dto, matchId };
  }

  /** The room outlives its matches: reopen it so the same group can play again. */
  @OnEvent(PlatformEvents.MatchFinished)
  async onMatchFinished(event: MatchFinishedEvent): Promise<void> {
    const room = await this.rooms.findById(event.roomId);
    // Only a room that was waiting on this match is reopened; a closed one stays closed.
    if (room?.status !== 'in_match') return;
    await this.rooms.resetMemberStatuses(event.roomId);
    await this.rooms.update(event.roomId, { status: 'open' });
    await this.changed(event.roomId);
  }

  private async changed(roomId: string): Promise<RoomDto> {
    const dto = await this.getDto(roomId);
    const event: RoomUpdatedEvent = { roomId };
    await this.events.emitAsync(PlatformEvents.RoomUpdated, event);
    return dto;
  }

  private async requireRoom(roomId: string): Promise<RoomRecord> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new AppError(ErrorCodes.RoomNotFound, 'Room not found.', 404);
    return room;
  }

  private async requireMember(roomId: string, userId: string): Promise<RoomMemberRecord[]> {
    const members = await this.rooms.listMembers(roomId);
    if (!members.some((member) => member.userId === userId)) {
      throw new AppError(ErrorCodes.NotRoomMember, 'You are not a member of this room.', 403);
    }
    return members;
  }

  private requireHost(room: RoomRecord, userId: string, message: string): void {
    if (room.hostUserId !== userId) throw new AppError(ErrorCodes.NotRoomHost, message, 403);
  }

  private findFreeSeat(members: RoomMemberRecord[], maxPlayers: number): number {
    const taken = new Set(members.map((member) => member.seat));
    const seat = Array.from({ length: maxPlayers }, (_, index) => index).find(
      (candidate) => !taken.has(candidate),
    );
    if (seat === undefined) throw new AppError(ErrorCodes.RoomFull, 'The room is full.', 409);
    return seat;
  }

  /** A room cannot be changed under a match. An administrator ends the match first. */
  private requireNotInMatch(room: Pick<RoomRecord, 'status'>): void {
    if (room.status === 'in_match') {
      throw new AppError(
        ErrorCodes.RoomInMatch,
        'A match is in progress in this room. End the match first.',
        409,
      );
    }
  }

  private requireOpen(room: RoomRecord): void {
    if (room.status !== 'open') {
      throw new AppError(ErrorCodes.RoomNotOpen, 'The room is not open.', 409);
    }
  }

  private async toDto(room: RoomRecord, members: RoomMemberRecord[]): Promise<RoomDto> {
    return {
      id: room.id,
      code: room.code,
      gameType: room.gameType,
      hostUserId: room.hostUserId,
      status: room.status,
      visibility: room.visibility,
      settings: room.settings,
      members,
      currentMatchId:
        room.status === 'in_match' ? await this.rooms.findCurrentMatchId(room.id) : null,
      createdAt: room.createdAt.toISOString(),
    };
  }
}
