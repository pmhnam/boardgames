import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { matches, roomMembers, rooms, users } from '../../infrastructure/database/schema.js';

export type RoomRecord = typeof rooms.$inferSelect;
export type RoomMemberStatus = (typeof roomMembers.$inferSelect)['status'];

export interface RoomMemberRecord {
  userId: string;
  displayName: string;
  seat: number;
  status: RoomMemberStatus;
}

@Injectable()
export class RoomsRepository {
  constructor(private readonly connection: DatabaseConnection) {}

  async create(room: typeof rooms.$inferInsert): Promise<void> {
    await this.connection.db.transaction(async (tx) => {
      await tx.insert(rooms).values(room);
      await tx
        .insert(roomMembers)
        .values({ roomId: room.id, userId: room.hostUserId, seat: 0, status: 'joined' });
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

  listMembers(roomId: string): Promise<RoomMemberRecord[]> {
    return this.connection.db
      .select({
        userId: roomMembers.userId,
        displayName: users.displayName,
        seat: roomMembers.seat,
        status: roomMembers.status,
      })
      .from(roomMembers)
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .where(eq(roomMembers.roomId, roomId))
      .orderBy(asc(roomMembers.seat));
  }

  async addMember(roomId: string, userId: string, seat: number): Promise<void> {
    await this.connection.db.insert(roomMembers).values({ roomId, userId, seat, status: 'joined' });
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

  async resetMemberStatuses(roomId: string): Promise<void> {
    await this.connection.db
      .update(roomMembers)
      .set({ status: 'joined' })
      .where(eq(roomMembers.roomId, roomId));
  }

  async update(
    roomId: string,
    patch: Partial<Pick<RoomRecord, 'status' | 'hostUserId'>>,
  ): Promise<void> {
    await this.connection.db.update(rooms).set(patch).where(eq(rooms.id, roomId));
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
