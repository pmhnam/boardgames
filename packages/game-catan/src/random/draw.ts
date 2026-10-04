import { createSeededRandom, type SeededRandom } from '@bgp/game-core';
import type { RandomState } from '../domain/state.js';

/**
 * Randomness during a match. The engine is only handed the seed at setup, so the state carries
 * it along with a count of the draws made so far: each draw gets a fresh source keyed on both,
 * and a replay of the same actions draws exactly the same things.
 */
export function drawRandom(random: Readonly<RandomState>): {
  source: SeededRandom;
  next: RandomState;
} {
  return {
    source: createSeededRandom(`${random.seed}:draw:${random.draws}`),
    next: { seed: random.seed, draws: random.draws + 1 },
  };
}
