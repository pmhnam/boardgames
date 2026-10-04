import { HEX_SIDES, edgeId, hexCorners, hexKey, type Hex } from './hex.js';

/**
 * How the corners and edges of a board hang together. It follows entirely from the list of
 * hexes, so it is worked out on demand and never stored in a match.
 */
export interface Topology {
  hexes: string[];
  vertices: string[];
  edges: string[];
  /** The six corners of each hex, clockwise from the top. */
  hexVertices: Record<string, string[]>;
  /** The hexes on the board that touch a corner: one to three. */
  vertexHexes: Record<string, string[]>;
  vertexEdges: Record<string, string[]>;
  vertexNeighbours: Record<string, string[]>;
  edgeVertices: Record<string, [string, string]>;
}

function push(record: Record<string, string[]>, key: string, value: string): void {
  const list = record[key];
  if (!list) record[key] = [value];
  else if (!list.includes(value)) list.push(value);
}

function build(hexes: readonly Hex[]): Topology {
  const topology: Topology = {
    hexes: hexes.map(hexKey),
    vertices: [],
    edges: [],
    hexVertices: {},
    vertexHexes: {},
    vertexEdges: {},
    vertexNeighbours: {},
    edgeVertices: {},
  };

  for (const hex of hexes) {
    const key = hexKey(hex);
    const corners = hexCorners(hex);
    topology.hexVertices[key] = corners;
    corners.forEach((corner, index) => {
      const next = corners[(index + 1) % HEX_SIDES.length] as string;
      const edge = edgeId(corner, next);
      push(topology.vertexHexes, corner, key);
      push(topology.vertexEdges, corner, edge);
      push(topology.vertexEdges, next, edge);
      push(topology.vertexNeighbours, corner, next);
      push(topology.vertexNeighbours, next, corner);
      topology.edgeVertices[edge] = corner < next ? [corner, next] : [next, corner];
    });
  }

  topology.vertices = Object.keys(topology.vertexHexes).sort();
  topology.edges = Object.keys(topology.edgeVertices).sort();
  return topology;
}

/** Boards are few and never change, so each one's topology is worked out once. */
const cache = new Map<string, Topology>();
const CACHE_LIMIT = 16;

export function buildTopology(hexes: readonly Hex[]): Topology {
  const key = hexes.map(hexKey).join(';');
  const known = cache.get(key);
  if (known) return known;

  const topology = build(hexes);
  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, topology);
  return topology;
}

export function edgesAt(topology: Topology, vertex: string): string[] {
  return topology.vertexEdges[vertex] ?? [];
}

export function neighboursOf(topology: Topology, vertex: string): string[] {
  return topology.vertexNeighbours[vertex] ?? [];
}

export function hexesAt(topology: Topology, vertex: string): string[] {
  return topology.vertexHexes[vertex] ?? [];
}

export function cornersOf(topology: Topology, hex: string): string[] {
  return topology.hexVertices[hex] ?? [];
}

export function endsOf(topology: Topology, edge: string): [string, string] {
  const ends = topology.edgeVertices[edge];
  if (!ends) throw new Error(`Unknown edge ${edge}`);
  return ends;
}

/** The corner at the far end of an edge. */
export function otherEnd(topology: Topology, edge: string, vertex: string): string {
  const [a, b] = endsOf(topology, edge);
  return a === vertex ? b : a;
}
