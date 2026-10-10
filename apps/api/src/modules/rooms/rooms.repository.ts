import { Injectable } from '@nestjs/common';
import type { BotLevel } from '@bgp/shared-types';
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  isNull,
  ne,
  or,
  inArray,
} from 'drizzle-orm';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { containsText } from '../../infrastructure/database/like.js';
import { matches, roomMembers, rooms, users } from '../../infrastructure/database/schema.js';

export type RoomRecord = typeof rooms.$inferSelect;
export type RoomMemberStatus = (typeof roomMembers.$inferSelect)['status'];

export interface RoomMemberRecord {
  userId: string;
  displayName: string;
  seat: number;
  status: RoomMemberStatus;
  botLevel: BotLevel | null;
}

export type RoomWithHost = RoomRecord & { hostDisplayName: string };

export interface RoomListFilter {
  gameType?: string;
  status?: RoomRecord['status'];
  /** Part of the room code or of the host's name. */
  q?: string;
}

export type CloseRoomOutcome = 'closed' | 'already_closed' | 'in_match' | 'not_found';

const withHostColumns = { ...getTableColumns(rooms), hostDisplayName: users.displayName };

const memberColumns = {
  userId: roomMembers.userId,
  displayName: users.displayName,
  seat: roomMembers.seat,
  status: roomMembers.status,
  botLevel: roomMembers.botLevel,
};

function roomsFilter(filter: RoomListFilter) {
  return and(
    filter.gameType === undefined ? undefined : eq(rooms.gameType, filter.gameType),
    filter.status === undefined ? undefined : eq(rooms.status, filter.status),
    filter.q === undefined
      ? undefined
      : or(containsText(rooms.code, filter.q), containsText(users.displayName, filter.q)),
  );
}

@Injectable()
export class RoomsRepository {
  constructor(private readonly connection: DatabaseConnection) {}

  async create(room: typeof rooms.$inferInsert): Promise<void> {
    await this.connection.db.transaction(async (tx) => {
      await tx.insert(rooms).values(room);
      await tx
        .insert(roomMembers)
        .values({ roomId: room.id, userId: room.hostUserId, seat: 0, status: 'ready' });
    });
  }

  async findById(roomId: string): Promise<RoomRecord | null> {
    const [room] = await this.connection.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .limit(1);
    return room ?? null;
  }

  async findByCode(code: string): Promise<RoomRecord | null> {
    const [room] = await this.connection.db
      .select()
      .from(rooms)
      .where(eq(rooms.code, code))
      .limit(1);
    return room ?? null;
  }

  async findWithHost(roomId: string): Promise<RoomWithHost | null> {
    const [room] = await this.connection.db
      .select(withHostColumns)
      .from(rooms)
      .innerJoin(users, eq(users.id, rooms.hostUserId))
      .where(eq(rooms.id, roomId))
      .limit(1);
    return room ?? null;
  }

  /** Every room, newest first: private and closed ones too. For the admin area only. */
  listPage(
    filter: RoomListFilter,
    page: { limit: number; offset: number },
  ): Promise<RoomWithHost[]> {
    return this.connection.db
      .select(withHostColumns)
      .from(rooms)
      .innerJoin(users, eq(users.id, rooms.hostUserId))
      .where(roomsFilter(filter))
      .orderBy(desc(rooms.createdAt), desc(rooms.id))
      .limit(page.limit)
      .offset(page.offset);
  }

  async countPage(filter: RoomListFilter): Promise<number> {
    const [row] = await this.connection.db
      .select({ total: count() })
      .from(rooms)
      .innerJoin(users, eq(users.id, rooms.hostUserId))
      .where(roomsFilter(filter));
    return row?.total ?? 0;
  }

  /** The rooms a person has a seat in, newest first. */
  listForMember(userId: string): Promise<RoomWithHost[]> {
    return this.connection.db
      .select(withHostColumns)
      .from(rooms)
      .innerJoin(users, eq(users.id, rooms.hostUserId))
      .innerJoin(roomMembers, eq(roomMembers.roomId, rooms.id))
      .where(eq(roomMembers.userId, userId))
      .orderBy(desc(rooms.createdAt), desc(rooms.id));
  }

  /** The members of many rooms in one query, in seat order. */
  async listMembersForRooms(roomIds: string[]): Promise<Map<string, RoomMemberRecord[]>> {
    const byRoom = new Map<string, RoomMemberRecord[]>();
    if (roomIds.length === 0) return byRoom;
    const rows = await this.connection.db
      .select({ ...memberColumns, roomId: roomMembers.roomId })
      .from(roomMembers)
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .where(inArray(roomMembers.roomId, roomIds))
      .orderBy(asc(roomMembers.seat));
    for (const { roomId, ...member } of rows) {
      byRoom.set(roomId, [...(byRoom.get(roomId) ?? []), member]);
    }
    return byRoom;
  }

  /** The match being played in each of these rooms, for those that have one. */
  async findCurrentMatchIds(roomIds: string[]): Promise<Map<string, string>> {
    const byRoom = new Map<string, string>();
    if (roomIds.length === 0) return byRoom;
    const rows = await this.connection.db
      .select({ roomId: matches.roomId, id: matches.id })
      .from(matches)
      .where(and(inArray(matches.roomId, roomIds), eq(matches.status, 'playing')))
      .orderBy(asc(matches.createdAt));
    // Oldest first, so the newest match of a room is the one left in the map.
    for (const row of rows) byRoom.set(row.roomId, row.id);
    return byRoom;
  }

  /**
   * Closes an open room and empties it, in one step. Conditional on the room still being open,
   * so it cannot close a room out from under a match that started a moment ago.
   */
  async closeAndClear(roomId: string): Promise<CloseRoomOutcome> {
    return this.connection.db.transaction(async (tx) => {
      const closed = await tx
        .update(rooms)
        .set({ status: 'closed' })
        .where(and(eq(rooms.id, roomId), eq(rooms.status, 'open')))
        .returning({ id: rooms.id });
      if (closed.length > 0) {
        await tx.delete(roomMembers).where(eq(roomMembers.roomId, roomId));
        return 'closed';
      }
      const [room] = await tx
        .select({ status: rooms.status })
        .from(rooms)
        .where(eq(rooms.id, roomId));
      if (!room) return 'not_found';
      return room.status === 'in_match' ? 'in_match' : 'already_closed';
    });
  }

  listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    return this.connection.db
      .select(memberColumns)
      .from(roomMembers)
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .where(eq(roomMembers.roomId, roomId))
      .orderBy(asc(roomMembers.seat));
  }

  /** Every player takes their seat already ready. */
  async addMember(
    roomId: string,
    userId: string,
    seat: number,
    botLevel: BotLevel | null = null,
  ): Promise<void> {
    await this.connection.db
      .insert(roomMembers)
      .values({ roomId, userId, seat, status: 'ready', botLevel });
  }

  async removeMember(roomId: string, userId: string): Promise<void> {
    await this.connection.db
      .delete(roomMembers)
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
  }

  async setMemberStatus(roomId: string, userId: string, status: RoomMemberStatus): Promise<void> {
    await this.connection.db
      .update(roomMembers)
      .set({ status })
      .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
  }

  async resetMemberStatuses(roomId: string, status: RoomMemberStatus = 'ready'): Promise<void> {
    await this.connection.db
      .update(roomMembers)
      .set({ status })
      // Computer players stay ready.
      .where(and(eq(roomMembers.roomId, roomId), isNull(roomMembers.botLevel)));
  }

  async update(
    roomId: string,
    patch: Partial<Pick<RoomRecord, 'status' | 'hostUserId' | 'settings'>>,
  ): Promise<void> {
    await this.connection.db.update(rooms).set(patch).where(eq(rooms.id, roomId));
  }

  /** Rooms that are still in use and were created recently, newest first. */
  listActive(createdAfter: Date, limit: number): Promise<RoomRecord[]> {
    return this.connection.db
      .select()
      .from(rooms)
      .where(
        and(
          ne(rooms.status, 'closed'),
          or(
            gt(rooms.createdAt, createdAfter),
            inArray(
              rooms.id,
              this.connection.db
                .select({ roomId: matches.roomId })
                .from(matches)
                .where(eq(matches.status, 'playing')),
            ),
          ),
        ),
      )
      .orderBy(desc(rooms.createdAt))
      .limit(limit);
  }

  async findCurrentMatchId(roomId: string): Promise<string | null> {
    const [match] = await this.connection.db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.roomId, roomId), eq(matches.status, 'playing')))
      .orderBy(desc(matches.createdAt))
      .limit(1);
    return match?.id ?? null;
  }
}
