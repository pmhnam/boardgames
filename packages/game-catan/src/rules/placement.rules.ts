import type { GameValidationResult } from '@bgp/game-core';
import { CatanRuleCodes, VALID, invalid } from '../domain/errors.js';
import type { Pieces } from '../domain/game-config.js';
import type { CatanState } from '../domain/state.js';
import { buildTopology, edgesAt, endsOf, neighboursOf, type Topology } from '../domain/topology.js';

type Board = Pick<CatanState, 'config' | 'buildings' | 'roads'>;

export function getTopology(state: Pick<CatanState, 'config'>): Topology {
  return buildTopology(state.config.hexes);
}

/** The pieces a player has not put on the board yet. A city hands its settlement back. */
export function getPiecesLeft(state: Board, playerId: string): Pieces {
  const buildings = Object.values(state.buildings).filter(
    (building) => building.playerId === playerId,
  );
  const roads = Object.values(state.roads).filter((owner) => owner === playerId).length;
  const cities = buildings.filter((building) => building.kind === 'city').length;
  return {
    roads: state.config.pieces.roads - roads,
    settlements: state.config.pieces.settlements - (buildings.length - cities),
    cities: state.config.pieces.cities - cities,
  };
}

/** A corner takes a settlement when it is empty and so are the corners next to it. */
export function validateSettlementSite(state: Board, vertex: string): GameValidationResult {
  const topology = getTopology(state);
  if (!topology.vertexEdges[vertex]) {
    return invalid(CatanRuleCodes.InvalidVertex, 'That is not a corner of the board.');
  }
  if (state.buildings[vertex]) {
    return invalid(CatanRuleCodes.VertexOccupied, 'That corner is already built on.');
  }
  if (neighboursOf(topology, vertex).some((neighbour) => state.buildings[neighbour])) {
    return invalid(CatanRuleCodes.TooClose, 'That corner is next to another building.');
  }
  return VALID;
}

function hasOwnRoadAt(state: Board, playerId: string, vertex: string): boolean {
  return edgesAt(getTopology(state), vertex).some((edge) => state.roads[edge] === playerId);
}

/** Outside the opening a settlement must also stand on one of the player's own roads. */
export function validateConnectedSettlementSite(
  state: Board,
  playerId: string,
  vertex: string,
): GameValidationResult {
  const site = validateSettlementSite(state, vertex);
  if (!site.valid) return site;
  if (!hasOwnRoadAt(state, playerId, vertex)) {
    return invalid(CatanRuleCodes.NotConnected, 'A settlement must be on one of your roads.');
  }
  return VALID;
}

/**
 * A road continues from the player's own building, or from their own road unless somebody
 * else's building stands in between.
 */
function reachesEdgeFrom(state: Board, playerId: string, vertex: string): boolean {
  const building = state.buildings[vertex];
  if (building) return building.playerId === playerId;
  return hasOwnRoadAt(state, playerId, vertex);
}

export function validateRoadSite(
  state: Board,
  playerId: string,
  edge: string,
): GameValidationResult {
  const topology = getTopology(state);
  if (!topology.edgeVertices[edge]) {
    return invalid(CatanRuleCodes.InvalidEdge, 'That is not an edge of the board.');
  }
  if (state.roads[edge]) {
    return invalid(CatanRuleCodes.EdgeOccupied, 'That edge already has a road.');
  }
  if (!endsOf(topology, edge).some((vertex) => reachesEdgeFrom(state, playerId, vertex))) {
    return invalid(
      CatanRuleCodes.NotConnected,
      'A road must continue from your own road or building.',
    );
  }
  return VALID;
}

/** In the opening the road starts at the settlement just placed. */
export function validateSetupRoadSite(
  state: Board & Pick<CatanState, 'turn'>,
  edge: string,
): GameValidationResult {
  const topology = getTopology(state);
  if (!topology.edgeVertices[edge]) {
    return invalid(CatanRuleCodes.InvalidEdge, 'That is not an edge of the board.');
  }
  if (state.roads[edge]) {
    return invalid(CatanRuleCodes.EdgeOccupied, 'That edge already has a road.');
  }
  const { setupVertex } = state.turn;
  if (setupVertex === null || !endsOf(topology, edge).includes(setupVertex)) {
    return invalid(
      CatanRuleCodes.NotConnected,
      'The road must start at the settlement you just placed.',
    );
  }
  return VALID;
}

export function validateCitySite(
  state: Board,
  playerId: string,
  vertex: string,
): GameValidationResult {
  if (!getTopology(state).vertexEdges[vertex]) {
    return invalid(CatanRuleCodes.InvalidVertex, 'That is not a corner of the board.');
  }
  const building = state.buildings[vertex];
  if (!building || building.playerId !== playerId || building.kind !== 'settlement') {
    return invalid(
      CatanRuleCodes.NotYourSettlement,
      'A city replaces one of your own settlements.',
    );
  }
  return VALID;
}

export function listOpeningSettlementSites(state: Board): string[] {
  return getTopology(state).vertices.filter(
    (vertex) => validateSettlementSite(state, vertex).valid,
  );
}

export function listSettlementSites(state: Board, playerId: string): string[] {
  return getTopology(state).vertices.filter(
    (vertex) => validateConnectedSettlementSite(state, playerId, vertex).valid,
  );
}

export function listRoadSites(state: Board, playerId: string): string[] {
  return getTopology(state).edges.filter((edge) => validateRoadSite(state, playerId, edge).valid);
}

export function listSetupRoadSites(state: Board & Pick<CatanState, 'turn'>): string[] {
  const { setupVertex } = state.turn;
  if (setupVertex === null) return [];
  return edgesAt(getTopology(state), setupVertex).filter((edge) => !state.roads[edge]);
}

export function listCitySites(state: Board, playerId: string): string[] {
  return Object.entries(state.buildings)
    .filter(([, building]) => building.playerId === playerId && building.kind === 'settlement')
    .map(([vertex]) => vertex)
    .sort();
}
