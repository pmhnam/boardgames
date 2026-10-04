import { describe, expect, it } from 'vitest';
import { DEFAULT_HARBORS, DEFAULT_HEXES } from '../src/domain/default-board.js';
import { hexCorners, hexKey, hexNeighbour, hexSideEdge, parseEdgeId } from '../src/domain/hex.js';
import { buildTopology, endsOf, neighboursOf } from '../src/domain/topology.js';

const topology = buildTopology(DEFAULT_HEXES);

describe('the island', () => {
  it('has 19 hexes, 54 corners and 72 edges', () => {
    expect(topology.hexes).toHaveLength(19);
    expect(topology.vertices).toHaveLength(54);
    expect(topology.edges).toHaveLength(72);
  });

  it('gives every hex six different corners', () => {
    for (const hex of DEFAULT_HEXES) {
      expect(new Set(hexCorners(hex)).size).toBe(6);
      expect(topology.hexVertices[hexKey(hex)]).toEqual(hexCorners(hex));
    }
  });

  it('names a corner the same from each of the three hexes that share it', () => {
    // The upper-right corner of the centre is the bottom of the hex above it and the
    // upper-left of the hex to its right.
    const fromCentre = hexCorners({ q: 0, r: 0 })[1];
    expect(hexCorners({ q: 1, r: -1 })[3]).toBe(fromCentre);
    expect(hexCorners({ q: 1, r: 0 })[5]).toBe(fromCentre);
    expect(topology.vertexHexes[fromCentre as string]?.sort()).toEqual(['0,0', '1,-1', '1,0']);
  });

  it('names an edge the same from both hexes that share it', () => {
    const centre = { q: 0, r: 0 };
    expect(hexSideEdge(centre, 'E')).toBe(hexSideEdge(hexNeighbour(centre, 'E'), 'W'));
    expect(hexSideEdge(centre, 'SE')).toBe(hexSideEdge(hexNeighbour(centre, 'SE'), 'NW'));
    expect(hexSideEdge(centre, 'SW')).toBe(hexSideEdge(hexNeighbour(centre, 'SW'), 'NE'));
  });

  it('touches one to three hexes at every corner, and two or three other corners', () => {
    for (const vertex of topology.vertices) {
      const hexes = topology.vertexHexes[vertex]?.length ?? 0;
      const neighbours = neighboursOf(topology, vertex).length;
      expect(hexes).toBeGreaterThanOrEqual(1);
      expect(hexes).toBeLessThanOrEqual(3);
      expect(neighbours).toBeGreaterThanOrEqual(2);
      expect(neighbours).toBeLessThanOrEqual(3);
      expect(topology.vertexEdges[vertex]).toHaveLength(neighbours);
    }
  });

  it('joins two neighbouring corners with every edge', () => {
    for (const edge of topology.edges) {
      const [a, b] = endsOf(topology, edge);
      expect(parseEdgeId(edge)).toEqual([a, b]);
      expect(neighboursOf(topology, a)).toContain(b);
      expect(neighboursOf(topology, b)).toContain(a);
    }
  });

  it('is worked out once per board', () => {
    expect(buildTopology(DEFAULT_HEXES.map((hex) => ({ ...hex })))).toBe(topology);
  });
});

describe('the default harbors', () => {
  const edges = DEFAULT_HARBORS.map((harbor) => hexSideEdge(harbor, harbor.side));

  it('are nine: four generic and one for each resource', () => {
    expect(DEFAULT_HARBORS.map((harbor) => harbor.type).sort()).toEqual(
      ['any', 'any', 'any', 'any', 'brick', 'grain', 'ore', 'wood', 'wool'].sort(),
    );
  });

  it('sit on coastal edges and share no corner', () => {
    const onBoard = new Set(topology.hexes);
    for (const harbor of DEFAULT_HARBORS) {
      expect(onBoard.has(hexKey(hexNeighbour(harbor, harbor.side)))).toBe(false);
    }
    const corners = edges.flatMap((edge) => endsOf(topology, edge));
    expect(new Set(corners).size).toBe(18);
  });
});
