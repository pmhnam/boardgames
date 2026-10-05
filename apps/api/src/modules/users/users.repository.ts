import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { users } from '../../infrastructure/database/schema.js';

export type UserRecord = typeof users.$inferSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly connection: DatabaseConnection) {}

  async create(input: { id: string; displayName: string; isBot?: boolean }): Promise<UserRecord> {
    const [user] = await this.connection.db.insert(users).values(input).returning();
    if (!user) throw new Error('Failed to insert user');
    return user;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [user] = await this.connection.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }

  async findOrCreateHuman(input: { id: string; displayName: string }): Promise<UserRecord> {
    const [created] = await this.connection.db
      .insert(users)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [existing] = await this.connection.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isBot, false),
          sql`lower(btrim(${users.displayName})) = lower(btrim(${input.displayName}))`,
        ),
      )
      .limit(1);
    if (!existing) throw new Error('Failed to resolve username');
    return existing;
  }
}
