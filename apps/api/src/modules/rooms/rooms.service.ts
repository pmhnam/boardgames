import { randomInt, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  ErrorCodes,
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
import { GameRegistry } from '../games/game-registry.js';
import { MatchesService } from '../matches/matches.service.js';
import { RoomsRepository, type RoomMemberRecord, type RoomRecord } from './rooms.repository.js';

// No 0/O/1/I: codes get read aloud and typed by hand.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function generateRoomCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)],
  ).join('');
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly rooms: RoomsRepository,
    private readonly registry: GameRegistry,
    private readonly matches: MatchesService,
    private readonly events: EventEmitter2,
  ) {}

  async create(
    userId: string,
    input: { gameType: string; visibility: RoomVisibility },
  ): Promise<RoomDto> {
    this.registry.get(input.gameType);
    const id = randomUUID();
    await this.rooms.create({
      id,
      code: generateRoomCode(),
      gameType: input.gameType,
      hostUserId: userId,
      status: 'open',
      visibility: input.visibility,
    });
    return this.getDto(id);
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
    const takenSeats = new Set(members.map((member) => member.seat));
    const seat = Array.from({ length: maxPlayers }, (_, index) => index).find(
      (candidate) => !takenSeats.has(candidate),
    );
    if (seat === undefined) throw new AppError(ErrorCodes.RoomFull, 'The room is full.', 409);

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

    await this.rooms.removeMember(roomId, userId);
    const remaining = members.filter((member) => member.userId !== userId);
    const nextHost = remaining[0];
    if (!nextHost) {
      await this.rooms.update(roomId, { status: 'closed' });
    } else if (room.hostUserId === userId) {
      await this.rooms.update(roomId, { hostUserId: nextHost.userId });
    }
    return this.changed(roomId);
  }

  async setReady(roomId: string, userId: string, ready: boolean): Promise<RoomDto> {
    const room = await this.requireRoom(roomId);
    await this.requireMember(roomId, userId);
    this.requireOpen(room);
    await this.rooms.setMemberStatus(roomId, userId, ready ? 'ready' : 'joined');
    return this.changed(roomId);
  }

  async start(roomId: string, userId: string): Promise<StartRoomResponse> {
    const room = await this.requireRoom(roomId);
    const members = await this.requireMember(roomId, userId);
    this.requireOpen(room);

    if (room.hostUserId !== userId) {
      throw new AppError(ErrorCodes.NotRoomHost, 'Only the host can start the match.', 403);
    }
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
      members: members.map(({ userId: memberId, seat }) => ({ userId: memberId, seat })),
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
      members,
      currentMatchId:
        room.status === 'in_match' ? await this.rooms.findCurrentMatchId(room.id) : null,
      createdAt: room.createdAt.toISOString(),
    };
  }
}
