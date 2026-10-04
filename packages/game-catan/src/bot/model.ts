import type { HarborType } from '../domain/default-board.js';
import type { Costs } from '../domain/game-config.js';
import { hexKey } from '../domain/hex.js';
import {
  RESOURCES,
  countResources,
  emptyResources,
  type ResourceCounts,
} from '../domain/resources.js';
import { buildTopology, edgesAt, endsOf, neighboursOf, type Topology } from '../domain/topology.js';
import type { CatanView, HexView, PlayerView } from '../visibility/public-view.js';

/**
 * What a bot works from: its own seat's view, with the board's topology and a few lookups
 * worked out once. Everything here is in the view; nothing comes from the raw state.
 */
export interface Model {
  view: CatanView;
  playerId: string;
  me: PlayerView;
  hand: ResourceCounts;
  topology: Topology;
  tiles: Record<string, HexView>;
  /** The harbor a building on each corner would trade through. */
  harbors: Record<string, HarborType>;
}

export function readView(view: CatanView, playerId: string): Model {
  const me = view.players[playerId];
  if (!me) throw new Error(`CATAN bot is not seated as ${playerId}`);
  const topology = buildTopology(view.board.hexes);
  const harbors: Record<string, HarborType> = {};
  for (const harbor of view.board.harbors) {
    for (const vertex of endsOf(topology, harbor.edge)) harbors[vertex] = harbor.type;
  }
  return {
    view,
    playerId,
    me,
    hand: me.resources ?? emptyResources(),
    topology,
    tiles: Object.fromEntries(view.board.hexes.map((hex) => [hexKey(hex), hex])),
    harbors,
  };
}

/** A corner nobody has built on or next to. */
export function isOpen(model: Model, vertex: string): boolean {
  const { buildings } = model.view;
  return (
    !buildings[vertex] &&
    neighboursOf(model.topology, vertex).every((neighbour) => !buildings[neighbour])
  );
}

function hasOwnRoad(model: Model, vertex: string): boolean {
  return edgesAt(model.topology, vertex).some((edge) => model.view.roads[edge] === model.playerId);
}

/** Open corners the seat's roads already reach: where it could settle, cards permitting. */
export function listReachableSites(model: Model): string[] {
  return model.topology.vertices.filter(
    (vertex) => isOpen(model, vertex) && hasOwnRoad(model, vertex),
  );
}

export function listOwnBuildings(model: Model, kind?: 'settlement' | 'city'): string[] {
  return Object.entries(model.view.buildings)
    .filter(
      ([, building]) =>
        building.playerId === model.playerId && (kind === undefined || building.kind === kind),
    )
    .map(([vertex]) => vertex)
    .sort();
}

export function listOpponents(model: Model): string[] {
  return model.view.turnOrder.filter((playerId) => playerId !== model.playerId);
}

/** The cards of a cost the hand does not cover. */
export function getShortfall(
  hand: Readonly<ResourceCounts>,
  cost: Readonly<ResourceCounts>,
): ResourceCounts {
  const missing = emptyResources();
  for (const resource of RESOURCES)
    missing[resource] = Math.max(0, cost[resource] - hand[resource]);
  return missing;
}

export type Goal = keyof Costs;

export interface Plan {
  goal: Goal;
  cost: ResourceCounts;
  /** How many cards the seat is short of paying for it. */
  missing: number;
}

/**
 * What the seat should save up for. Each thing it could still build is a candidate; the one
 * nearest to being paid for wins, and ties go to the one worth more: a city, a settlement,
 * a road towards a new site, then a development card.
 */
export function choosePlan(model: Model): Plan | null {
  const { view, me } = model;
  const reachable = listReachableSites(model).length > 0;
  const goals: Goal[] = [];
  if (me.piecesLeft.cities > 0 && listOwnBuildings(model, 'settlement').length > 0) {
    goals.push('city');
  }
  if (me.piecesLeft.settlements > 0 && reachable) goals.push('settlement');
  if (me.piecesLeft.roads > 0 && me.piecesLeft.settlements > 0 && !reachable) goals.push('road');
  if (view.developmentDeckCount > 0) goals.push('developmentCard');

  let best: Plan | null = null;
  for (const goal of goals) {
    const cost = view.costs[goal];
    const missing = countResources(getShortfall(model.hand, cost));
    if (!best || missing < best.missing) best = { goal, cost, missing };
  }
  return best;
}
