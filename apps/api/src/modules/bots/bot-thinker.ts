import { Worker } from 'node:worker_threads';
import { Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import { createSeededRandom, type BotLevel } from '@bgp/game-core';
import { GameRegistry } from '../games/game-registry.js';
import type { BotAnswer, BotThought } from './bot-worker.js';

export type BotQuestion = Omit<BotThought, 'id'>;

/** A strategy that has not answered in this long is stuck, not thinking. */
const ANSWER_WITHIN_MS = 15_000;
/** With no bot to move for this long, the thread and its memory are given back. */
const REST_AFTER_MS = 120_000;

const here = import.meta.url;
const WORKER_URL = new URL(`./bot-worker${here.slice(here.lastIndexOf('.'))}`, here);

interface Waiting {
  resolve(action: unknown): void;
  reject(error: Error): void;
  timer: NodeJS.Timeout;
}

/**
 * Where the bots do their thinking: on one other thread, one question at a time, so the search
 * of a hard bot never stands between a player and their own move. If that thread cannot be
 * started at all, the thinking is done here instead: slower for everyone, but the bots play.
 */
@Injectable()
export class BotThinker implements OnApplicationShutdown {
  private readonly logger = new Logger(BotThinker.name);
  private worker: Worker | null = null;
  private readonly waiting = new Map<number, Waiting>();
  private nextId = 1;
  private everAnswered = false;
  private inline = false;
  private rest: NodeJS.Timeout | null = null;

  constructor(private readonly registry: GameRegistry) {}

  choose(question: BotQuestion): Promise<unknown> {
    if (this.inline) return this.chooseHere(question);
    let worker: Worker;
    try {
      worker = this.worker ?? this.start();
    } catch (error) {
      this.giveUpOnThread(error);
      return this.chooseHere(question);
    }
    if (this.rest) clearTimeout(this.rest);
    this.rest = null;

    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // The only way to stop a strategy that will not return is to end the thread it is on.
        this.stop(new Error('The bot took too long to choose.'));
      }, ANSWER_WITHIN_MS);
      this.waiting.set(id, { resolve, reject, timer });
      const thought: BotThought = { id, ...question };
      worker.postMessage(thought);
    });
  }

  onApplicationShutdown(): void {
    this.stop(new Error('Shutting down.'));
  }

  private start(): Worker {
    // Its own flags, not this process's: a debugger or a test runner's are not meant for it.
    const worker = new Worker(WORKER_URL, { execArgv: [] });
    worker.on('message', (answer: BotAnswer) => {
      const asked = this.waiting.get(answer.id);
      if (!asked) return;
      this.waiting.delete(answer.id);
      clearTimeout(asked.timer);
      this.everAnswered = true;
      if ('error' in answer) asked.reject(new Error(answer.error));
      else asked.resolve(answer.action);
      if (this.waiting.size === 0) this.restSoon();
    });
    worker.on('error', (error) => {
      if (this.worker !== worker) return;
      // A thread that never managed a single answer is not going to: stop trying to start it.
      if (!this.everAnswered) this.giveUpOnThread(error);
      this.stop(error);
    });
    worker.on('exit', () => {
      if (this.worker === worker) this.stop(new Error('The bot thread stopped.'));
    });
    this.worker = worker;
    return worker;
  }

  private restSoon(): void {
    this.rest = setTimeout(() => {
      if (this.waiting.size === 0) this.stop(new Error('Resting.'));
    }, REST_AFTER_MS);
    this.rest.unref();
  }

  /** Ends the thread; whoever was still waiting on it is told why. The next question starts another. */
  private stop(reason: Error): void {
    const worker = this.worker;
    this.worker = null;
    if (this.rest) clearTimeout(this.rest);
    this.rest = null;
    for (const asked of this.waiting.values()) {
      clearTimeout(asked.timer);
      asked.reject(reason);
    }
    this.waiting.clear();
    void worker?.terminate();
  }

  private giveUpOnThread(error: unknown): void {
    if (this.inline) return;
    this.inline = true;
    this.logger.error(
      `Bots will think on the main thread: their own could not be started. ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }`,
    );
  }

  private async chooseHere(question: BotQuestion): Promise<unknown> {
    const bot = this.registry.get(question.gameType).bot;
    if (!bot) throw new Error(`No bot for game type: ${question.gameType}`);
    const action: unknown = bot.chooseAction({
      view: question.view,
      playerId: question.playerId,
      level: question.level as BotLevel,
      random: createSeededRandom(question.seed),
    });
    return action;
  }
}
