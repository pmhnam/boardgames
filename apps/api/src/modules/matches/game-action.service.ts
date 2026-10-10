import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CommonRuleCodes } from '@bgp/game-core';
import { ErrorCodes, type GameActionAccepted } from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import {
  PlatformEvents,
  type MatchFinishedEvent,
  type MatchStateChangedEvent,
} from '../../common/events/platform-events.js';
import type { OpaqueGameState } from '../../infrastructure/database/schema.js';
import { GameRegistry } from '../games/game-registry.js';
import { MatchRepository } from './match.repository.js';

export interface AbandonMatchCommand {
  matchId: string;
  /** The administrator ending it. From the authenticated request, never from a payload. */
  byUserId: string;
  now: Date;
}

export interface ExecuteGameActionCommand {
  matchId: string;
  /** From the authenticated connection, never from the payload. */
  userId: string;
  requestId: string;
  expectedVersion: number;
  /** Untrusted. Parsed by the game's engine. */
  action: unknown;
  now: Date;
  /** Internal runner credential. Never parsed from an HTTP/WebSocket request. */
  automation?: { controlVersion: number };
}

/**
 * The single pipeline every game mutation goes through, for humans and (later) bots alike.
 * Knows nothing about any specific game: rules live behind the engine.
 */
@Injectable()
export class GameActionService {
  private readonly logger = new Logger(GameActionService.name);

  constructor(
    private readonly matches: MatchRepository,
    private readonly registry: GameRegistry,
    private readonly events: EventEmitter2,
  ) {}

  async execute(command: ExecuteGameActionCommand): Promise<GameActionAccepted> {
    const startedAt = performance.now();

    const match = await this.matches.findById(command.matchId);
    if (!match) throw new AppError(ErrorCodes.MatchNotFound, 'Match not found.', 404);

    const players = await this.matches.listPlayers(match.id);
    const player = players.find((candidate) => candidate.userId === command.userId);
    if (!player) {
      throw new AppError(ErrorCodes.Forbidden, 'You are not a player in this match.', 403);
    }

    // Idempotency: a retried request reports success without applying anything twice.
    if (await this.matches.hasAction(match.id, command.requestId)) {
      return this.accepted(command, match.stateVersion, true);
    }

    if (match.status !== 'playing') throw this.notPlaying();

    const automated = player.botLevel !== null || player.autoplayLevel !== null;
    if (
      automated !== Boolean(command.automation) ||
      (command.automation && command.automation.controlVersion !== player.controlVersion)
    ) {
      throw this.controlChanged();
    }

    if (match.stateVersion !== command.expectedVersion) {
      throw this.versionConflict(match.stateVersion);
    }

    const { engine } = this.registry.getForMatch(match);

    const parsed = engine.parseAction(command.action);
    if (!parsed.ok) throw new AppError(ErrorCodes.InvalidAction, parsed.message, 400);

    const context = {
      actorPlayerId: player.playerId,
      requestId: command.requestId,
      now: command.now.toISOString(),
    };

    const validation = engine.validateAction(match.state, parsed.action, context);
    if (!validation.valid) {
      throw validation.code === CommonRuleCodes.NotYourTurn
        ? new AppError(ErrorCodes.NotYourTurn, validation.message, 409)
        : new AppError(ErrorCodes.InvalidAction, validation.message, 400, {
            rule: validation.code,
          });
    }

    const newState: OpaqueGameState = engine.applyAction(match.state, parsed.action, context);
    const finished = engine.getGameStatus(newState) === 'finished';
    const nextVersion = match.stateVersion + 1;
    const actionType = (parsed.action as { type: string }).type;

    const outcome = await this.matches.saveActionAndState({
      matchId: match.id,
      expectedVersion: match.stateVersion,
      action: {
        id: randomUUID(),
        playerId: player.playerId,
        actionType,
        payload: parsed.action,
        requestId: command.requestId,
        createdAt: command.now,
      },
      state: newState,
      status: finished ? 'finished' : 'playing',
      result: finished ? engine.getResult(newState) : null,
      finishedAt: finished ? command.now : null,
      control: { automated: Boolean(command.automation), version: player.controlVersion },
    });

    if (outcome === 'duplicate_request') {
      const latest = await this.matches.findById(match.id);
      return this.accepted(command, latest?.stateVersion ?? nextVersion, true);
    }
    if (outcome === 'version_conflict') {
      const latest = await this.matches.findById(match.id);
      // Not a newer move to catch up with: the match ended while this one was being worked out.
      if (latest && latest.status !== 'playing') throw this.notPlaying();
      throw this.versionConflict(latest?.stateVersion ?? nextVersion);
    }
    if (outcome === 'control_changed') throw this.controlChanged();

    this.logger.log({
      event: 'game_action_processed',
      requestId: command.requestId,
      gameId: match.id,
      gameType: match.gameType,
      userId: command.userId,
      playerId: player.playerId,
      actionType,
      stateVersion: nextVersion,
      durationMs: Math.round(performance.now() - startedAt),
    });

    const changed: MatchStateChangedEvent = { matchId: match.id };
    await this.events.emitAsync(PlatformEvents.MatchStateChanged, changed);
    if (finished) {
      const finishedEvent: MatchFinishedEvent = { matchId: match.id, roomId: match.roomId };
      await this.events.emitAsync(PlatformEvents.MatchFinished, finishedEvent);
    }

    return this.accepted(command, nextVersion, false);
  }

  /**
   * Ends a match in progress with no winner, for one that is stuck or should not go on. The
   * other way a match's status changes, so it lives here beside the first. It never asks the
   * engine anything, which is what lets it end a match saved by rules that no longer exist.
   */
  async abandon(command: AbandonMatchCommand): Promise<void> {
    const outcome = await this.matches.markAbandoned(command.matchId, command.now);
    if (outcome.outcome === 'not_found') {
      throw new AppError(ErrorCodes.MatchNotFound, 'Match not found.', 404);
    }
    if (outcome.outcome !== 'abandoned') throw this.notPlaying();

    this.logger.log({
      event: 'match_abandoned',
      gameId: command.matchId,
      byUserId: command.byUserId,
    });

    // No new state to show anyone. What follows from a match being over (the room reopening,
    // everyone at the table being told) hangs off this one event.
    const finished: MatchFinishedEvent = { matchId: command.matchId, roomId: outcome.roomId };
    await this.events.emitAsync(PlatformEvents.MatchFinished, finished);
  }

  private notPlaying(): AppError {
    return new AppError(ErrorCodes.MatchNotPlaying, 'This match is not in progress.', 409);
  }

  private accepted(
    command: ExecuteGameActionCommand,
    version: number,
    duplicate: boolean,
  ): GameActionAccepted {
    return { gameId: command.matchId, requestId: command.requestId, version, duplicate };
  }

  private versionConflict(latestVersion: number): AppError {
    return new AppError(
      ErrorCodes.GameVersionConflict,
      'The game has moved on. Refresh and try again.',
      409,
      { latestVersion },
    );
  }

  private controlChanged(): AppError {
    return new AppError(
      ErrorCodes.GameControlChanged,
      'Quyền điều khiển đã thay đổi. Hãy tắt bot để tự chơi.',
      409,
    );
  }
}
