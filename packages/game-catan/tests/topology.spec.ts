import { describe, expect, it } from 'vitest';
import { listCoast } from '../src/domain/coast.js';
import { DEFAULT_FRAME, DEFAULT_HEXES } from '../src/domain/default-board.js';
import { layFrame } from '../src/domain/game-config.js';
import {
  HEX_SIDES,
  hexCorners,
  hexKey,
  hexNeighbour,
  hexSideEdge,
  parseEdgeId,
  type HexSide,
} from '../src/domain/hex.js';
import { listSpiral } from '../src/domain/spiral.js';
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

describe('the coast', () => {
  const coast = listCoast(DEFAULT_HEXES, DEFAULT_FRAME.start);

  it('is a ring of 30 edges, each on one hex only, starting where it is told to', () => {
    expect(coast).toHaveLength(30);
    expect(new Set(coast).size).toBe(30);
    expect(coast?.[0]).toBe(hexSideEdge({ q: 0, r: -2 }, 'NW'));
    const onBoard = new Set(topology.hexes);
    for (const hex of DEFAULT_HEXES) {
      for (const side of HEX_SIDES) {
        const coastal = !onBoard.has(hexKey(hexNeighbour(hex, side)));
        expect(coast?.includes(hexSideEdge(hex, side))).toBe(coastal);
      }
    }
  });

  it('runs clockwise, each edge meeting the next at a corner', () => {
    expect(coast?.slice(0, 4)).toEqual([
      hexSideEdge({ q: 0, r: -2 }, 'NW'),
      hexSideEdge({ q: 0, r: -2 }, 'NE'),
      hexSideEdge({ q: 1, r: -2 }, 'NW'),
      hexSideEdge({ q: 1, r: -2 }, 'NE'),
    ]);
    coast?.forEach((edge, index) => {
      const next = coast[(index + 1) % coast.length] as string;
      const shared = endsOf(topology, edge).filter((end) => endsOf(topology, next).includes(end));
      expect(shared).toHaveLength(1);
    });
  });

  it('is refused from a side that faces inland, or round an island with a lake', () => {
    expect(listCoast(DEFAULT_HEXES, { q: 0, r: -2, side: 'SE' })).toBeNull();
    expect(listCoast(DEFAULT_HEXES, { q: 9, r: 9, side: 'NW' })).toBeNull();
    const lake = DEFAULT_HEXES.filter((hex) => hex.q !== 0 || hex.r !== 0);
    expect(listCoast(lake, DEFAULT_FRAME.start)).toBeNull();
  });
});

describe('the sea frame', () => {
  const fixed = layFrame(DEFAULT_HEXES, DEFAULT_FRAME.start, DEFAULT_FRAME.pieces);
  const at = (q: number, r: number, side: HexSide) =>
    fixed.find((port) => port.edge === hexSideEdge({ q, r }, side))?.type;

  it('carries nine ports: four generic and one for each resource', () => {
    expect(fixed.map((port) => port.type).sort()).toEqual(
      ['any', 'any', 'any', 'any', 'brick', 'wheat', 'ore', 'wood', 'wool'].sort(),
    );
  });

  it('puts them where the rulebook shows them when laid in order', () => {
    expect(at(0, -2, 'NW')).toBe('any');
    expect(at(1, -2, 'NE')).toBe('wool');
    expect(at(2, -1, 'NE')).toBe('any');
    expect(at(2, 0, 'E')).toBe('any');
    expect(at(1, 1, 'SE')).toBe('brick');
    expect(at(-1, 2, 'SE')).toBe('wood');
    expect(at(-2, 2, 'SW')).toBe('any');
    expect(at(-2, 1, 'W')).toBe('wheat');
    expect(at(-1, -1, 'W')).toBe('ore');
  });

  it('never lets two ports share a corner, in whatever order the pieces are laid', () => {
    const pieces = DEFAULT_FRAME.pieces;
    const orders = [
      pieces,
      [...pieces].reverse(),
      [0, 2, 4, 1, 3, 5].map((index) => pieces[index] as (typeof pieces)[number]),
      [1, 3, 5, 0, 2, 4].map((index) => pieces[index] as (typeof pieces)[number]),
    ];
    for (const order of orders) {
      const ports = layFrame(DEFAULT_HEXES, DEFAULT_FRAME.start, order);
      const corners = ports.flatMap((port) => endsOf(topology, port.edge));
      expect(ports).toHaveLength(9);
      expect(new Set(corners).size).toBe(18);
    }
  });
});

describe('the spiral the number discs follow', () => {
  const keys = (corner: number) => listSpiral(DEFAULT_HEXES, corner).map(hexKey);

  it('goes counterclockwise round the outside from a corner, then inwards to the middle', () => {
    // From the upper-right corner, as the rulebook draws it.
    expect(keys(0)).toEqual([
      '2,-2',
      '1,-2',
      '0,-2',
      '-1,-1',
      '-2,0',
      '-2,1',
      '-2,2',
      '-1,2',
      '0,2',
      '1,1',
      '2,0',
      '2,-1',
      '1,-1',
      '0,-1',
      '-1,0',
      '-1,1',
      '0,1',
      '1,0',
      '0,0',
    ]);
  });

  it('visits every hex once from each of the six corners', () => {
    const starts = new Set<string>();
    for (let corner = 0; corner < 6; corner += 1) {
      const spiral = keys(corner);
      expect([...spiral].sort()).toEqual([...topology.hexes].sort());
      expect(spiral.at(-1)).toBe('0,0');
      starts.add(spiral[0] as string);
    }
    expect([...starts].sort()).toEqual(['-2,0', '-2,2', '0,-2', '0,2', '2,-2', '2,0']);
  });
});
