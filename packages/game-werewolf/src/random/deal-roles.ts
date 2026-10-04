import { createSeededRandom } from '@bgp/game-core';
import { listRoles } from '../domain/game-config.js';
import type { RoleCounts, RoleId } from '../domain/roles.js';

/**
 * Who plays what. This is the only randomness in a match: everything after the deal follows
 * from what the players do.
 */
export function dealRoles(input: {
  seed: string;
  seatOrder: readonly string[];
  roleCounts: RoleCounts;
}): Record<string, RoleId> {
  const shuffled = createSeededRandom(input.seed).shuffle(listRoles(input.roleCounts));
  const dealt: Record<string, RoleId> = {};
  input.seatOrder.forEach((playerId, index) => {
    dealt[playerId] = shuffled[index] ?? 'villager';
  });
  return dealt;
}
