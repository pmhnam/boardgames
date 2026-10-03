import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { users } from '../../infrastructure/database/schema.js';

export type UserRecord = typeof users.$inferSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly connection: DatabaseConnection) {}

  async create(input: { id: string; displayName: string }): Promise<UserRecord> {
    const [user] = await this.connection.db.insert(users).values(input).returning();
    if (!user) throw new Error('Failed to insert user');
    return user;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [user] = await this.connection.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  }
}
