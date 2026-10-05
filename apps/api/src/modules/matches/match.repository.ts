import { Injectable } from '@nestjs/common';
import { ErrorCodes, type BotLevel, type PlayerAutoplayDto } from '@bgp/shared-types';
import { and, asc, desc, eq, isNotNull, or } from 'drizzle-orm';
import { AppError } from '../../common/errors/app-error.js';
import { DatabaseConnection } from '../../infrastructure/database/database.connection.js';
import { uniqueViolationConstraint } from '../../infrastructure/database/pg-errors.js';
import { retainedMatch } from './match-retention.js';
import {
  matchActions,
  matchPlayers,
  matches,
  users,
  type OpaqueGameState,
} from '../../infrastructure/database/schema.js';

export type MatchRecord = typeof matches.$inferSelect;
export type MatchActionRecord = typeof matchActions.$inferSelect;

export interface MatchPlayerRecord {
  playerId: string;
  userId: string;
  seat: number;
  displayName: string;
  botLevel: BotLevel | null;
  autoplayLevel: BotLevel | null;
  controlVersion: number;
}

export interface SaveActionAndStateInput {
  matchId: string;
  expectedVersion: number;
  action: {
    id: string;
    playerId: string;
    actionType: string;
    payload: Record<string, unknown>;
    requestId: string;
    createdAt: Date;
  };
  state: OpaqueGameState;
  status: MatchRecord['status'];
  result: MatchRecord['result'];
  finishedAt: Date | null;
  /** Only server code supplies automation credentials, never the client payload. */
  control: { automated: boolean; version: number };
}

export type SaveActionOutcome =
  'saved' | 'version_conflict' | 'duplicate_request' | 'control_changed';

class VersionConflict extends Error {}
class ControlChanged extends Error {}

@Injectable()
export class MatchRepository {
  constructor(private readonly connection: DatabaseConnection) {}

  async create(input: {
    match: typeof matches.$inferInsert;
    players: Array<Omit<typeof matchPlayers.$inferInsert, 'matchId'>>;
  }): Promise<void> {
    await this.connection.db.transaction(async (tx) => {
      await tx.insert(matches).values(input.match);
      await tx
        .insert(matchPlayers)
        .values(input.players.map((player) => ({ ...player, matchId: input.match.id })));
    });
  }

  async findById(matchId: string): Promise<MatchRecord | null> {
    const [match] = await this.connection.db
      .select()
      .from(matches)
      .where(and(eq(matches.id, matchId), retainedMatch()))
      .limit(1);
    return match ?? null;
  }

  listPlayers(matchId: string): Promise<MatchPlayerRecord[]> {
    return this.connection.db
      .select({
        playerId: matchPlayers.playerId,
        userId: matchPlayers.userId,
        seat: matchPlayers.seat,
        displayName: users.displayName,
        botLevel: matchPlayers.botLevel,
        autoplayLevel: matchPlayers.autoplayLevel,
        controlVersion: matchPlayers.controlVersion,
      })
      .from(matchPlayers)
      .innerJoin(users, eq(users.id, matchPlayers.userId))
      .where(eq(matchPlayers.matchId, matchId))
      .orderBy(asc(matchPlayers.seat));
  }

  async hasAction(matchId: string, requestId: string): Promise<boolean> {
    const [row] = await this.connection.db
      .select({ id: matchActions.id })
      .from(matchActions)
      .where(and(eq(matchActions.matchId, matchId), eq(matchActions.requestId, requestId)))
      .limit(1);
    return row !== undefined;
  }

  listActions(matchId: string): Promise<MatchActionRecord[]> {
    return this.connection.db
      .select()
      .from(matchActions)
      .where(eq(matchActions.matchId, matchId))
      .orderBy(asc(matchActions.sequence));
  }

  /** Matches in progress that have a computer player: the ones that may be waiting on one. */
  listPlayingWithBots(): Promise<string[]> {
    return this.connection.db
      .selectDistinct({ id: matches.id })
      .from(matches)
      .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
      .where(
        and(
          eq(matches.status, 'playing'),
          or(isNotNull(matchPlayers.botLevel), isNotNull(matchPlayers.autoplayLevel)),
        ),
      )
      .then((rows) => rows.map((row) => row.id));
  }

  async setAutoplay(matchId: string, userId: string, enabled: boolean): Promise<PlayerAutoplayDto> {
    return this.connection.db.transaction(async (tx) => {
      // Same lock order as action commits: a handoff cannot overtake an action's final check.
      const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).for('update');
      if (!match) throw new AppError(ErrorCodes.MatchNotFound, 'Match not found.', 404);
      if (match.status !== 'playing')
        throw new AppError(ErrorCodes.MatchNotPlaying, 'This match is not in progress.', 409);
      const [player] = await tx
        .select()
        .from(matchPlayers)
        .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.userId, userId)))
        .for('update');
      if (!player || player.botLevel !== null)
        throw new AppError(ErrorCodes.Forbidden, 'You can only control your own human seat.', 403);
      const level = enabled ? 'normal' : null;
      if (player.autoplayLevel === level)
        return { playerId: player.playerId, level, version: player.controlVersion };
      const version = player.controlVersion + 1;
      await tx
        .update(matchPlayers)
        .set({ autoplayLevel: level, controlVersion: version })
        .where(and(eq(matchPlayers.matchId, matchId), eq(matchPlayers.playerId, player.playerId)));
      return { playerId: player.playerId, level, version };
    });
  }

  listForUser(userId: string, limit = 50): Promise<MatchRecord[]> {
    return this.connection.db
      .select({ match: matches })
      .from(matches)
      .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
      .where(and(eq(matchPlayers.userId, userId), retainedMatch()))
      .orderBy(desc(matches.createdAt))
      .limit(limit)
      .then((rows) => rows.map((row) => row.match));
  }

  /**
   * Appends the action and swaps in the new state atomically. The UPDATE is a compare-and-swap
   * on state_version, so of two concurrent writers exactly one wins and the other rolls back.
   */
  async saveActionAndState(input: SaveActionAndStateInput): Promise<SaveActionOutcome> {
    const nextVersion = input.expectedVersion + 1;
    try {
      const duplicateRequest = await this.connection.db.transaction(async (tx) => {
        const [match] = await tx
          .select()
          .from(matches)
          .where(eq(matches.id, input.matchId))
          .for('update');
        // Preserve request idempotency even if control changed after the original commit.
        const [duplicate] = await tx
          .select({ id: matchActions.id })
          .from(matchActions)
          .where(
            and(
              eq(matchActions.matchId, input.matchId),
              eq(matchActions.requestId, input.action.requestId),
            ),
          )
          .limit(1);
        if (duplicate) return true;
        if (!match || match.status !== 'playing' || match.stateVersion !== input.expectedVersion)
          throw new VersionConflict();
        const [player] = await tx
          .select()
          .from(matchPlayers)
          .where(
            and(
              eq(matchPlayers.matchId, input.matchId),
              eq(matchPlayers.playerId, input.action.playerId),
            ),
          )
          .for('update');
        const automated = player && (player.botLevel !== null || player.autoplayLevel !== null);
        if (
          !player ||
          player.controlVersion !== input.control.version ||
          Boolean(automated) !== input.control.automated
        )
          throw new ControlChanged();
        await tx.insert(matchActions).values({
          ...input.action,
          matchId: input.matchId,
          sequence: nextVersion,
        });

        const updated = await tx
          .update(matches)
          .set({
            state: input.state,
            stateVersion: nextVersion,
            status: input.status,
            result: input.result,
            finishedAt: input.finishedAt,
          })
          .where(
            and(eq(matches.id, input.matchId), eq(matches.stateVersion, input.expectedVersion)),
          )
          .returning({ id: matches.id });

        if (updated.length === 0) throw new VersionConflict();
        return false;
      });
      return duplicateRequest ? 'duplicate_request' : 'saved';
    } catch (error) {
      if (error instanceof VersionConflict) return 'version_conflict';
      if (error instanceof ControlChanged) return 'control_changed';
      const constraint = uniqueViolationConstraint(error);
      if (constraint === null) throw error;
      // A concurrent writer already took this sequence number, unless it was our own retry.
      return (await this.hasAction(input.matchId, input.action.requestId))
        ? 'duplicate_request'
        : 'version_conflict';
    }
  }
}
