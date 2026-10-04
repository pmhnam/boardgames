import { createSeededRandom } from '@bgp/game-core';
import { CHARACTER_IDS, type CharacterId } from '../domain/characters.js';
import { listRoles, type BangConfig } from '../domain/game-config.js';
import type { RoleCounts, RoleId } from '../domain/roles.js';

export interface DealtSetup {
  /** One per seat, in seat order. */
  roles: RoleId[];
  characters: CharacterId[];
  /** Card ids, shuffled. */
  deck: string[];
}

/** Everything the seed decides before the first turn. */
export function dealSetup(input: {
  seed: string;
  config: BangConfig;
  roleCounts: RoleCounts;
  cardIds: string[];
}): DealtSetup {
  const random = createSeededRandom(input.seed);
  const enabled = CHARACTER_IDS.filter((id) => input.config.characters[id].enabled);
  return {
    roles: random.shuffle(listRoles(input.roleCounts)),
    characters: random.shuffle(enabled),
    deck: random.shuffle(input.cardIds),
  };
}
