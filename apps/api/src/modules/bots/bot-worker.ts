import { parentPort } from 'node:worker_threads';
import { createSeededRandom, type BotLevel } from '@bgp/game-core';

/**
 * Runs the bots' strategies off the main thread: a hard bot's search takes long enough to hold
 * up every other match's sockets if it ran there. Like the runner, it is handed a seat's view
 * and nothing else.
 *
 * Plain Node runs this file as it is, compiled or not, so it keeps to syntax that can simply be
 * erased, and finds the list of games beside itself under whichever extension it has.
 */
export interface BotThought {
  id: number;
  gameType: string;
  view: unknown;
  playerId: string;
  level: BotLevel;
  /** A strategy's randomness comes from this, so its play can be reproduced. */
  seed: string;
}

export type BotAnswer = { id: number; action: unknown } | { id: number; error: string };

const here = import.meta.url;
const extension = here.slice(here.lastIndexOf('.'));
const { registeredGames } = (await import(
  new URL(`../games/registered-games${extension}`, here).href
)) as typeof import('../games/registered-games.js');

const bots = new Map(registeredGames.map((game) => [game.definition.gameType, game.bot]));

parentPort?.on('message', (thought: BotThought) => {
  let answer: BotAnswer;
  try {
    const bot = bots.get(thought.gameType);
    if (!bot) throw new Error(`No bot for game type: ${thought.gameType}`);
    const action: unknown = bot.chooseAction({
      view: thought.view,
      playerId: thought.playerId,
      level: thought.level,
      random: createSeededRandom(thought.seed),
    });
    answer = { id: thought.id, action };
  } catch (error) {
    answer = { id: thought.id, error: error instanceof Error ? error.message : String(error) };
  }
  parentPort?.postMessage(answer);
});
