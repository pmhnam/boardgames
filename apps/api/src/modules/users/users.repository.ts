import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { containsText } from '../../infrastructure/database/like.js';
import { users } from '../../infrastructure/database/schema.js';

export type UserRecord = typeof users.$inferSelect;

export interface UserListFilter {
  /** Part of a name. */
  q?: string;
  /** Computer players are users too, and are left out unless asked for. */
  includeBots: boolean;
}

function usersFilter(filter: UserListFilter) {
  return and(
    filter.includeBots ? undefined : eq(users.isBot, false),
    filter.q === undefined ? undefined : containsText(users.displayName, filter.q),
  );
}

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

  /** Newest first, for the admin area. */
  listPage(filter: UserListFilter, page: { limit: number; offset: number }): Promise<UserRecord[]> {
    return this.connection.db
      .select()
      .from(users)
      .where(usersFilter(filter))
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(page.limit)
      .offset(page.offset);
  }

  async countPage(filter: UserListFilter): Promise<number> {
    const [row] = await this.connection.db
      .select({ total: count() })
      .from(users)
      .where(usersFilter(filter));
    return row?.total ?? 0;
  }

  /** Locks an account out from `at`, or lets it back in with null. */
  async setDisabled(id: string, at: Date | null): Promise<UserRecord | null> {
    const [user] = await this.connection.db
      .update(users)
      .set({ disabledAt: at, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user ?? null;
  }

  async findOrCreateHuman(input: { id: string; displayName: string }): Promise<UserRecord> {
    const [created] = await this.connection.db
      .insert(users)
      .values(input)
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const existing = await this.findHumanByName(input.displayName);
    if (!existing) throw new Error('Failed to resolve username');
    return existing;
  }

  /** Names are compared the way the unique index does: trimmed and case-insensitive. */
  async findHumanByName(displayName: string): Promise<UserRecord | null> {
    const [user] = await this.connection.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.isBot, false),
          sql`lower(btrim(${users.displayName})) = lower(btrim(${displayName}))`,
        ),
      )
      .limit(1);
    return user ?? null;
  }

  /**
   * Makes the person with this name an administrator with this password, creating them if the
   * name is free. Whoever held the name before keeps their seats and history, but not their
   * sessions: tokens are tied to the password.
   */
  async ensureAdmin(input: {
    id: string;
    displayName: string;
    passwordHash: string;
  }): Promise<UserRecord> {
    const [created] = await this.connection.db
      .insert(users)
      .values({ ...input, role: 'admin' })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const existing = await this.findHumanByName(input.displayName);
    if (!existing) throw new Error('Failed to resolve administrator username');
    const [promoted] = await this.connection.db
      .update(users)
      .set({
        role: 'admin',
        passwordHash: input.passwordHash,
        disabledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    if (!promoted) throw new Error('Failed to promote administrator');
    return promoted;
  }
}
