import { CITY_YIELD, ROBBER_ROLL, SETTLEMENT_YIELD } from '../domain/config.js';
import {
  RESOURCES,
  TERRAIN_RESOURCE,
  emptyResources,
  type Resource,
  type ResourceCounts,
} from '../domain/resources.js';
import { cornersOf, endsOf, hexesAt, neighboursOf } from '../domain/topology.js';
import { isOpen, listOpponents, listOwnBuildings, type Model } from './model.js';

/** Ways two dice can make a number: how often a hex with that token produces, out of 36. */
export function getPips(number: number | null): number {
  if (number === null || number === ROBBER_ROLL) return 0;
  return 6 - Math.abs(ROBBER_ROLL - number);
}

/** What a settlement on a corner would collect, in pips per resource. */
export function getYield(model: Model, vertex: string): ResourceCounts {
  const yielded = emptyResources();
  for (const hex of hexesAt(model.topology, vertex)) {
    const tile = model.tiles[hex];
    const resource = tile ? TERRAIN_RESOURCE[tile.terrain] : null;
    if (tile && resource) yielded[resource] += getPips(tile.number);
  }
  return yielded;
}

/** What the seat's buildings collect now, in pips per resource. */
export function getProduction(model: Model): ResourceCounts {
  const production = emptyResources();
  for (const [vertex, building] of Object.entries(model.view.buildings)) {
    if (building.playerId !== model.playerId) continue;
    const yielded = getYield(model, vertex);
    const factor = building.kind === 'city' ? CITY_YIELD : SETTLEMENT_YIELD;
    for (const resource of RESOURCES) production[resource] += factor * yielded[resource];
  }
  return production;
}

/** What a kind of resource the seat does not produce yet is worth next to one it does. */
const NEW_RESOURCE_BONUS = 2;
/** What a harbor is worth: a generic one, and one for a resource the seat produces. */
const GENERIC_HARBOR_VALUE = 1.5;
const RESOURCE_HARBOR_VALUE = 0.5;

/**
 * How good a corner is to settle. The plain score is how often it produces, plus a little for
 * each different resource. The aware score also counts what the seat still lacks and what a
 * harbor there would do for what it already makes.
 */
export function evaluateSite(model: Model, vertex: string, aware: boolean): number {
  const yielded = getYield(model, vertex);
  const kinds = RESOURCES.filter((resource) => yielded[resource] > 0);
  const pips = RESOURCES.reduce((sum, resource) => sum + yielded[resource], 0);
  if (!aware) return pips + kinds.length;

  const production = getProduction(model);
  const fresh = kinds.filter((resource) => production[resource] === 0).length;
  const harbor = model.harbors[vertex];
  let harborValue = 0;
  if (harbor === 'any') harborValue = GENERIC_HARBOR_VALUE;
  else if (harbor) harborValue = RESOURCE_HARBOR_VALUE * (production[harbor] + yielded[harbor]);
  return pips + kinds.length + NEW_RESOURCE_BONUS * fresh + harborValue;
}

/** How much a road counts for the site two steps along it, next to one at its end. */
const NEXT_STEP_WEIGHT = 0.5;

/** How good an edge is to build on: the best open corner it leads towards. */
export function evaluateRoad(model: Model, edge: string, aware: boolean): number {
  let best = 0;
  for (const end of endsOf(model.topology, edge)) {
    if (model.view.buildings[end]) continue;
    if (isOpen(model, end)) best = Math.max(best, evaluateSite(model, end, aware));
    for (const next of neighboursOf(model.topology, end)) {
      if (!isOpen(model, next)) continue;
      best = Math.max(best, NEXT_STEP_WEIGHT * evaluateSite(model, next, aware));
    }
  }
  return best;
}

/** How much moving the robber to a hex costs a seat's own buildings, next to what it gains. */
const OWN_HEX_PENALTY = 3;

/**
 * How good a hex is for the robber: what it stops the others collecting, less what it stops
 * the seat itself collecting. The aware score leans on whoever is nearest to winning.
 */
export function evaluateRobberHex(model: Model, hex: string, aware: boolean): number {
  const tile = model.tiles[hex];
  const pips = tile ? getPips(tile.number) : 0;
  let value = 0;
  for (const vertex of cornersOf(model.topology, hex)) {
    const building = model.view.buildings[vertex];
    if (!building) continue;
    const collected = pips * (building.kind === 'city' ? CITY_YIELD : SETTLEMENT_YIELD);
    if (building.playerId === model.playerId) {
      value -= OWN_HEX_PENALTY * collected;
      continue;
    }
    const lead = model.view.players[building.playerId]?.publicPoints ?? 0;
    value += aware ? collected * (1 + lead / model.view.victoryPointsToWin) : collected;
  }
  return value;
}

/** Whether the robber is on a hex one of the seat's own buildings collects from. */
export function isRobbed(model: Model): boolean {
  const corners = cornersOf(model.topology, model.view.board.robber);
  return listOwnBuildings(model).some((vertex) => corners.includes(vertex));
}

/** The opponent with the most points on the table; the one with the most cards breaks ties. */
export function findLeader(model: Model, among = listOpponents(model)): string | undefined {
  const seat = (playerId: string) => model.view.players[playerId];
  return [...among].sort(
    (a, b) =>
      (seat(b)?.publicPoints ?? 0) - (seat(a)?.publicPoints ?? 0) ||
      (seat(b)?.resourceCount ?? 0) - (seat(a)?.resourceCount ?? 0) ||
      a.localeCompare(b),
  )[0];
}

/** The resource a hand is furthest over what a cost needs of it, if it holds any spare. */
export function findSpare(
  hand: Readonly<ResourceCounts>,
  cost: Readonly<ResourceCounts>,
): Resource | undefined {
  const spare = (resource: Resource) => hand[resource] - cost[resource];
  const [most] = RESOURCES.filter((resource) => hand[resource] > 0).sort(
    (a, b) => spare(b) - spare(a) || hand[b] - hand[a],
  );
  return most;
}
