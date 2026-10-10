import { Injectable } from '@nestjs/common';
import { and, count, desc, eq, getTableColumns } from 'drizzle-orm';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { uniqueViolationConstraint } from '../../infrastructure/database/pg-errors.js';
import { gameConfigs, users } from '../../infrastructure/database/schema.js';

export type GameConfigRecord = typeof gameConfigs.$inferSelect;

/** A version without its document, with the name of whoever published it. */
export interface GameConfigSummaryRecord {
  gameType: string;
  version: number;
  note: string | null;
  createdAt: Date;
  createdBy: string | null;
  authorName: string | null;
}

export type GameConfigWithAuthor = GameConfigRecord & { authorName: string | null };

const summaryColumns = {
  gameType: gameConfigs.gameType,
  version: gameConfigs.version,
  note: gameConfigs.note,
  createdAt: gameConfigs.createdAt,
  createdBy: gameConfigs.createdBy,
  authorName: users.displayName,
};

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

  async findVersion(gameType: string, version: number): Promise<GameConfigWithAuthor | null> {
    const [row] = await this.connection.db
      .select({ ...getTableColumns(gameConfigs), authorName: users.displayName })
      .from(gameConfigs)
      .leftJoin(users, eq(users.id, gameConfigs.createdBy))
      .where(and(eq(gameConfigs.gameType, gameType), eq(gameConfigs.version, version)))
      .limit(1);
    return row ?? null;
  }

  /** Newest first. Leaves the documents out: a game's history can hold many large ones. */
  listVersions(
    gameType: string,
    page: { limit: number; offset: number },
  ): Promise<GameConfigSummaryRecord[]> {
    return this.connection.db
      .select(summaryColumns)
      .from(gameConfigs)
      .leftJoin(users, eq(users.id, gameConfigs.createdBy))
      .where(eq(gameConfigs.gameType, gameType))
      .orderBy(desc(gameConfigs.version))
      .limit(page.limit)
      .offset(page.offset);
  }

  async countVersions(gameType: string): Promise<number> {
    const [row] = await this.connection.db
      .select({ total: count() })
      .from(gameConfigs)
      .where(eq(gameConfigs.gameType, gameType));
    return row?.total ?? 0;
  }

  /** The version in force for every game that has one, in a single query. */
  listLatest(): Promise<GameConfigSummaryRecord[]> {
    return this.connection.db
      .selectDistinctOn([gameConfigs.gameType], summaryColumns)
      .from(gameConfigs)
      .leftJoin(users, eq(users.id, gameConfigs.createdBy))
      .orderBy(gameConfigs.gameType, desc(gameConfigs.version));
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
    createdBy?: string | null;
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
