import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { BotLevel } from '@bgp/game-core';
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
import { BotThinker } from './bot-thinker.js';
import {
  MatchRepository,
  type MatchRecord,
  type MatchSnapshot,
} from '../matches/match.repository.js';

type StepOutcome = 'acted' | 'retry' | 'idle';

interface BotLoop {
  /** Something changed since the loop last looked. */
  dirty: boolean;
  /**
   * The match as last saved, when whoever saved it passed it on: the next look then has no need
   * to read it back. Only the match. Who controls each seat is always read, because that can
   * change without the state doing so.
   */
  saved: MatchRecord | null;
}

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
  /** Matches with a loop running, and what it has been told since its last look. */
  private readonly loops = new Map<string, BotLoop>();
  private stopped = false;

  constructor(
    private readonly matches: MatchRepository,
    private readonly registry: GameRegistry,
    private readonly actions: GameActionService,
    private readonly config: AppConfig,
    private readonly thinker: BotThinker,
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
    // Told what was saved, a table with no computer player to move needs no look at all.
    if (event.snapshot && !this.awaitsComputer(event.snapshot)) return;
    this.wake(event.matchId, event.snapshot?.match);
  }

  @OnEvent(PlatformEvents.MatchControlChanged)
  onMatchControlChanged(event: MatchStateChangedEvent): void {
    this.wake(event.matchId);
  }

  /** Whether the state just saved leaves a computer player to move. */
  private awaitsComputer({ match, players }: MatchSnapshot): boolean {
    if (match.status !== 'playing') return false;
    const automated = players.filter(
      (player) => player.botLevel !== null || player.autoplayLevel !== null,
    );
    if (automated.length === 0) return false;
    const game = this.registry.get(match.gameType);
    if (!game.bot || game.engine.engineVersion !== match.engineVersion) return false;
    const toMove = game.engine.getCurrentPlayerIds(match.state);
    return automated.some((player) => toMove.includes(player.playerId));
  }

  /**
   * Returns at once: the action that triggered the event must not wait for the bots' replies.
   * One loop per match; a change that arrives while it runs is picked up by that loop.
   */
  private wake(matchId: string, saved: MatchRecord | null = null): void {
    const running = this.loops.get(matchId);
    if (running) {
      running.dirty = true;
      if (saved && saved.stateVersion >= (running.saved?.stateVersion ?? 0)) running.saved = saved;
      return;
    }
    const loop: BotLoop = { dirty: false, saved };
    this.loops.set(matchId, loop);
    void this.run(matchId, loop).finally(() => {
      this.loops.delete(matchId);
      // A handoff can arrive after the final idle check but before this cleanup microtask.
      if (loop.dirty && !this.stopped) this.wake(matchId);
    });
  }

  private async run(matchId: string, loop: BotLoop): Promise<void> {
    try {
      while (!this.stopped) {
        loop.dirty = false;
        const outcome = await this.step(matchId, loop);
        if (outcome === 'idle' && !loop.dirty) return;
      }
    } catch (error) {
      if (!this.stopped) {
        this.logger.error(error instanceof Error ? (error.stack ?? error.message) : error);
      }
    }
  }

  /** Plays one action for a computer player whose turn it is, if there is one. */
  private async step(matchId: string, loop: BotLoop): Promise<StepOutcome> {
    // Used once: a look that has to be repeated reads the match afresh.
    const saved = loop.saved;
    loop.saved = null;
    const [first, players] = await Promise.all([
      saved ?? this.matches.findById(matchId),
      this.matches.listPlayers(matchId),
    ]);
    let match = first;
    if (!match || match.status !== 'playing') return 'idle';

    const game = this.registry.get(match.gameType);
    if (!game.bot || game.engine.engineVersion !== match.engineVersion) return 'idle';

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
    const [current, currentPlayers] = await Promise.all([
      this.matches.findById(matchId),
      this.matches.listPlayers(matchId),
    ]);
    match = current;
    if (!match || match.status !== 'playing') return 'idle';
    bot = currentPlayers.find((player) => player.playerId === scheduledPlayerId);
    if (!bot || (bot.botLevel === null && bot.autoplayLevel === null)) return 'retry';
    if (!game.engine.getCurrentPlayerIds(match.state).includes(bot.playerId)) return 'retry';
    const level = bot.botLevel ?? bot.autoplayLevel;
    if (level === null) return 'idle';
    const currentMatch = match;
    const currentBot = bot;

    // Thought out on another thread: a hard bot's search would otherwise hold up every socket.
    const choose = (level: BotLevel): Promise<unknown> =>
      this.thinker.choose({
        gameType: currentMatch.gameType,
        view: game.engine.getPublicView(currentMatch.state, {
          type: 'player',
          playerId: currentBot.playerId,
        }),
        playerId: currentBot.playerId,
        level,
        // Derived from the match, so a bot's play can be reproduced.
        seed: `${currentMatch.randomSeed}:${currentMatch.stateVersion}:${level}`,
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
      await submit(await choose(level));
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
      await submit(await choose('easy'));
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
