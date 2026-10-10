import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { createSeededRandom, type BotLevel } from '@bgp/game-core';
import { ErrorCodes } from '@bgp/shared-types';
import { AppError } from '../../common/errors/app-error.js';
import {
  PlatformEvents,
  type MatchStartedEvent,
  type MatchStateChangedEvent,
} from '../../common/events/platform-events.js';
import { AppConfig } from '../../config/app-config.js';
import { GameRegistry } from '../games/game-registry.js';
import { GameActionService } from '../matches/game-action.service.js';
import { MatchRepository } from '../matches/match.repository.js';

type StepOutcome = 'acted' | 'retry' | 'idle';

/**
 * Plays the computer players' turns. A bot is not special: it is handed the view of its own
 * seat, and what it chooses goes through GameActionService exactly like a person's action.
 */
/**
 * The match moved on while the bot was choosing: someone else acted, control changed hands, or
 * the match ended. None of these is the bot's mistake; the next look sorts out what to do.
 */
function isOvertaken(error: unknown): boolean {
  return (
    error instanceof AppError &&
    (error.code === ErrorCodes.GameVersionConflict ||
      error.code === ErrorCodes.GameControlChanged ||
      error.code === ErrorCodes.MatchNotPlaying)
  );
}

@Injectable()
export class BotRunnerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotRunnerService.name);
  /** Matches with a loop running, and whether something changed since its last look. */
  private readonly loops = new Map<string, { dirty: boolean }>();
  private stopped = false;

  constructor(
    private readonly matches: MatchRepository,
    private readonly registry: GameRegistry,
    private readonly actions: GameActionService,
    private readonly config: AppConfig,
  ) {}

  /** A restart must not leave a match waiting forever on a computer player. */
  async onApplicationBootstrap(): Promise<void> {
    for (const matchId of await this.matches.listPlayingWithBots()) this.wake(matchId);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
  }

  @OnEvent(PlatformEvents.MatchStarted)
  onMatchStarted(event: MatchStartedEvent): void {
    this.wake(event.matchId);
  }

  @OnEvent(PlatformEvents.MatchStateChanged)
  onMatchStateChanged(event: MatchStateChangedEvent): void {
    this.wake(event.matchId);
  }

  @OnEvent(PlatformEvents.MatchControlChanged)
  onMatchControlChanged(event: MatchStateChangedEvent): void {
    this.wake(event.matchId);
  }

  /**
   * Returns at once: the action that triggered the event must not wait for the bots' replies.
   * One loop per match; a change that arrives while it runs is picked up by that loop.
   */
  private wake(matchId: string): void {
    const running = this.loops.get(matchId);
    if (running) {
      running.dirty = true;
      return;
    }
    const loop = { dirty: false };
    this.loops.set(matchId, loop);
    void this.run(matchId, loop).finally(() => {
      this.loops.delete(matchId);
      // A handoff can arrive after the final idle check but before this cleanup microtask.
      if (loop.dirty && !this.stopped) this.wake(matchId);
    });
  }

  private async run(matchId: string, loop: { dirty: boolean }): Promise<void> {
    try {
      while (!this.stopped) {
        loop.dirty = false;
        const outcome = await this.step(matchId);
        if (outcome === 'idle' && !loop.dirty) return;
      }
    } catch (error) {
      if (!this.stopped) {
        this.logger.error(error instanceof Error ? (error.stack ?? error.message) : error);
      }
    }
  }

  /** Plays one action for a computer player whose turn it is, if there is one. */
  private async step(matchId: string): Promise<StepOutcome> {
    let match = await this.matches.findById(matchId);
    if (!match || match.status !== 'playing') return 'idle';

    const game = this.registry.get(match.gameType);
    if (!game.bot || game.engine.engineVersion !== match.engineVersion) return 'idle';

    const players = await this.matches.listPlayers(matchId);
    const toMove = game.engine.getCurrentPlayerIds(match.state);
    let bot = players.find(
      (player) =>
        (player.botLevel !== null || player.autoplayLevel !== null) &&
        toMove.includes(player.playerId),
    );
    if (!bot) return 'idle';
    const scheduledPlayerId = bot.playerId;

    await this.pause();
    if (this.stopped) return 'idle';

    // Re-read after thinking time: the player may have reclaimed control or acted meanwhile.
    match = await this.matches.findById(matchId);
    if (!match || match.status !== 'playing') return 'idle';
    const currentPlayers = await this.matches.listPlayers(matchId);
    bot = currentPlayers.find((player) => player.playerId === scheduledPlayerId);
    if (!bot || (bot.botLevel === null && bot.autoplayLevel === null)) return 'retry';
    if (!game.engine.getCurrentPlayerIds(match.state).includes(bot.playerId)) return 'retry';
    const level = bot.botLevel ?? bot.autoplayLevel;
    if (level === null) return 'idle';
    const currentMatch = match;
    const currentBot = bot;

    const choose = (level: BotLevel): unknown =>
      game.bot?.chooseAction({
        view: game.engine.getPublicView(currentMatch.state, {
          type: 'player',
          playerId: currentBot.playerId,
        }),
        playerId: currentBot.playerId,
        level,
        // Derived from the match, so a bot's play can be reproduced.
        random: createSeededRandom(
          `${currentMatch.randomSeed}:${currentMatch.stateVersion}:${level}`,
        ),
      });
    const submit = (action: unknown) =>
      this.actions.execute({
        matchId,
        userId: currentBot.userId,
        requestId: randomUUID(),
        expectedVersion: currentMatch.stateVersion,
        action,
        now: new Date(),
        automation: { controlVersion: currentBot.controlVersion },
      });

    try {
      await submit(choose(level));
      return 'acted';
    } catch (error) {
      // Someone else moved first: look again.
      if (isOvertaken(error)) return 'retry';

      this.logger.warn(
        `Bot ${bot.playerId} (${level}) failed in match ${matchId}: ${
          error instanceof Error ? error.message : String(error)
        }. Falling back to a simple move.`,
      );
    }

    // The strategy threw or chose something illegal. Any legal move keeps the match going;
    // if even that fails, stop rather than spin.
    try {
      await submit(choose('easy'));
      return 'acted';
    } catch (error) {
      if (isOvertaken(error)) return 'retry';
      this.logger.error(
        `Bot ${bot.playerId} could not move in match ${matchId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return 'idle';
    }
  }

  private pause(): Promise<void> {
    const delay = this.config.botActionDelayMs;
    return delay > 0 ? new Promise((resolve) => setTimeout(resolve, delay)) : Promise.resolve();
  }
}
