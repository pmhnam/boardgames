import type { CatanState } from '../domain/state.js';
import { edgesAt, endsOf, otherEnd } from '../domain/topology.js';
import { getTopology } from '../rules/placement.rules.js';

type Board = Pick<CatanState, 'config' | 'roads' | 'buildings'>;

/**
 * The longest unbroken run of a player's roads: no road counted twice, and no passing through
 * a corner somebody else has built on. A run may start or end at such a corner.
 */
export function getRouteLength(state: Board, playerId: string): number {
  const topology = getTopology(state);
  const own = Object.keys(state.roads).filter((edge) => state.roads[edge] === playerId);
  const isBroken = (vertex: string) => {
    const building = state.buildings[vertex];
    return building !== undefined && building.playerId !== playerId;
  };

  const used = new Set<string>();
  const walk = (vertex: string): number => {
    let best = 0;
    for (const edge of edgesAt(topology, vertex)) {
      if (state.roads[edge] !== playerId || used.has(edge)) continue;
      used.add(edge);
      const far = otherEnd(topology, edge, vertex);
      best = Math.max(best, 1 + (isBroken(far) ? 0 : walk(far)));
      used.delete(edge);
    }
    return best;
  };

  const starts = new Set(own.flatMap((edge) => endsOf(topology, edge)));
  let longest = 0;
  for (const vertex of starts) longest = Math.max(longest, walk(vertex));
  return longest;
}

/**
 * Who holds Longest Route after the board changed. The holder keeps it while nobody is strictly
 * ahead; otherwise it goes to the one player with the longest route, and to nobody when several
 * are level or none is long enough.
 */
export function resolveLongestRoute(
  state: Board & Pick<CatanState, 'turnOrder' | 'longestRoutePlayerId'>,
): string | null {
  const lengths = state.turnOrder.map(
    (playerId) => [playerId, getRouteLength(state, playerId)] as const,
  );
  const longest = Math.max(...lengths.map(([, length]) => length));
  if (longest < state.config.longestRouteMinimum) return null;

  const leaders = lengths.filter(([, length]) => length === longest).map(([playerId]) => playerId);
  const holder = state.longestRoutePlayerId;
  if (holder !== null && leaders.includes(holder)) return holder;
  return leaders.length === 1 ? (leaders[0] ?? null) : null;
}
