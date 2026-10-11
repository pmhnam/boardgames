import path from 'node:path';
import { Logger, type OnApplicationShutdown } from '@nestjs/common';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type { AppConfig } from '../../config/app-config.js';
import * as schema from './schema.js';

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

// Same depth from src/ and dist/, so this resolves in dev, tests and production builds.
const MIGRATIONS_FOLDER = path.resolve(import.meta.dirname, '../../../drizzle');

export class DatabaseConnection implements OnApplicationShutdown {
  private constructor(
    readonly db: Database,
    private readonly close: () => Promise<void>,
  ) {}

  /**
   * PostgreSQL when DATABASE_URL is set, otherwise embedded PGlite (same SQL dialect, no server).
   * Pending migrations are applied on boot.
   */
  static async connect(config: AppConfig): Promise<DatabaseConnection> {
    const logger = new Logger(DatabaseConnection.name);

    if (config.databaseUrl) {
      const { default: pg } = await import('pg');
      const { drizzle } = await import('drizzle-orm/node-postgres');
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      const pool = new pg.Pool({
        connectionString: config.databaseUrl,
        // Fail a request rather than queue it for ever behind a database that has gone away.
        connectionTimeoutMillis: 10_000,
      });
      // An idle connection the server drops (a restart, a failover) reports here. Unheard, it
      // would take the whole process down; heard, the pool simply opens another.
      pool.on('error', (error) => logger.warn(`Idle database connection lost: ${error.message}`));
      const db = drizzle(pool, { schema });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      logger.log('Connected to PostgreSQL');
      return new DatabaseConnection(db as unknown as Database, () => pool.end());
    }

    if (config.nodeEnv === 'production') {
      throw new Error('DATABASE_URL must be set in production: PGlite is for development only.');
    }
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    const inMemory = config.pgliteDataDir.startsWith('memory://');
    if (!inMemory) {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(path.dirname(path.resolve(config.pgliteDataDir)), { recursive: true });
    }
    const client = new PGlite(config.pgliteDataDir);
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    logger.log(`Using embedded PGlite (${config.pgliteDataDir}) because DATABASE_URL is not set`);
    return new DatabaseConnection(db as unknown as Database, () => client.close());
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
