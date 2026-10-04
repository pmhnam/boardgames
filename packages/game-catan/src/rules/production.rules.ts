import { CITY_YIELD, SETTLEMENT_YIELD } from '../domain/config.js';
import {
  RESOURCES,
  TERRAIN_RESOURCE,
  emptyResources,
  type ResourceCounts,
} from '../domain/resources.js';
import type { CatanState } from '../domain/state.js';
import { cornersOf, hexesAt } from '../domain/topology.js';
import { getTopology } from './placement.rules.js';

type Board = Pick<CatanState, 'config' | 'tiles' | 'robber' | 'buildings' | 'supply'>;

/** What each player's buildings would collect from a roll, before looking at the supply. */
function getDemand(state: Board, roll: number): Record<string, ResourceCounts> {
  const topology = getTopology(state);
  const demand: Record<string, ResourceCounts> = {};
  for (const hex of topology.hexes) {
    const tile = state.tiles[hex];
    if (!tile || tile.number !== roll || hex === state.robber) continue;
    const resource = TERRAIN_RESOURCE[tile.terrain];
    if (!resource) continue;
    for (const vertex of cornersOf(topology, hex)) {
      const building = state.buildings[vertex];
      if (!building) continue;
      const counts = (demand[building.playerId] ??= emptyResources());
      counts[resource] += building.kind === 'city' ? CITY_YIELD : SETTLEMENT_YIELD;
    }
  }
  return demand;
}

/**
 * What a roll hands out. When the supply cannot pay everyone their share of a resource, nobody
 * gets any of it; a player who is the only one owed takes whatever is left.
 */
export function getProduction(state: Board, roll: number): Record<string, ResourceCounts> {
  const demand = getDemand(state, roll);
  const production: Record<string, ResourceCounts> = {};
  for (const resource of RESOURCES) {
    const owed = Object.entries(demand).filter(([, counts]) => counts[resource] > 0);
    const total = owed.reduce((sum, [, counts]) => sum + counts[resource], 0);
    const available = state.supply[resource];
    if (total > available && owed.length > 1) continue;
    for (const [playerId, counts] of owed) {
      const given = Math.min(counts[resource], available);
      if (given > 0) (production[playerId] ??= emptyResources())[resource] += given;
    }
  }
  return production;
}

/** One card for each producing hex around the last settlement of the opening. */
export function getOpeningYield(state: Board, vertex: string): ResourceCounts {
  const yielded = emptyResources();
  for (const hex of hexesAt(getTopology(state), vertex)) {
    const tile = state.tiles[hex];
    const resource = tile ? TERRAIN_RESOURCE[tile.terrain] : null;
    if (resource && yielded[resource] < state.supply[resource]) yielded[resource] += 1;
  }
  return yielded;
}
