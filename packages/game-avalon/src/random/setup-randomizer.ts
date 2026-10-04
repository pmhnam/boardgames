import { createSeededRandom } from '@bgp/game-core';
import type { Role } from '../domain/roles.js';

export interface RandomSetup {
  /** One role per seat, in seat order. */
  roles: Role[];
  firstLeaderIndex: number;
}

/**
 * All randomness in a match is decided here, up front, from the seed. Quest cards need no
 * shuffling: only how many Fails were played is ever announced.
 */
export function randomizeSetup(input: { seed: string; roles: readonly Role[] }): RandomSetup {
  const random = createSeededRandom(input.seed);
  return {
    roles: random.shuffle(input.roles),
    firstLeaderIndex: random.int(input.roles.length),
  };
}
