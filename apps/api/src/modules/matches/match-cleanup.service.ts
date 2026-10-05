import { Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { and, lte, ne, sql } from 'drizzle-orm';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { matches } from '../../infrastructure/database/schema.js';
import { MATCH_HISTORY_RETENTION_MS } from './match-retention.js';

@Injectable()
export class MatchCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchCleanupService.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly connection: DatabaseConnection) {}

  async onModuleInit(): Promise<void> {
    await this.cleanup();
    this.timer = setInterval(() => {
      void this.cleanup().catch((error: unknown) => this.logger.error(error));
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async cleanup(now = new Date()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      // match_players and match_actions are removed by their ON DELETE CASCADE constraints.
      await this.connection.db
        .delete(matches)
        .where(
          and(
            ne(matches.status, 'playing'),
            lte(
              sql`coalesce(${matches.finishedAt}, ${matches.createdAt})`,
              new Date(now.getTime() - MATCH_HISTORY_RETENTION_MS),
            ),
          ),
        );
    } finally {
      this.running = false;
    }
  }
}
