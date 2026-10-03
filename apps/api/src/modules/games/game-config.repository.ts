import { Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { uniqueViolationConstraint } from '../../infrastructure/database/pg-errors.js';
import { gameConfigs } from '../../infrastructure/database/schema.js';

export type GameConfigRecord = typeof gameConfigs.$inferSelect;

@Injectable()
export class GameConfigRepository {
  constructor(private readonly connection: DatabaseConnection) {}

  async findLatest(gameType: string): Promise<GameConfigRecord | null> {
    const [row] = await this.connection.db
      .select()
      .from(gameConfigs)
      .where(eq(gameConfigs.gameType, gameType))
      .orderBy(desc(gameConfigs.version))
      .limit(1);
    return row ?? null;
  }

  /**
   * Adds a version. Rows are never updated or deleted. Returns null when that version number
   * already exists, i.e. someone else published a config first.
   */
  async insert(input: {
    gameType: string;
    version: number;
    config: unknown;
    note: string | null;
  }): Promise<GameConfigRecord | null> {
    try {
      const [row] = await this.connection.db.insert(gameConfigs).values(input).returning();
      return row ?? null;
    } catch (error) {
      if (uniqueViolationConstraint(error) !== null) return null;
      throw error;
    }
  }
}
