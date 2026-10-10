import { DEFAULT_CATAN_CONFIG, buildTopology } from '@bgp/game-catan';
import { describe, expect, it } from 'vitest';
import { ICON_PATHS } from './art/icons';
import { CARD_ICON, SIZE, edgePoints, hexCentre, portSpot, towards } from './layout';
import { CATAN_TEXT } from './text';
import { handDifference } from './useHandChange';

const hexes = DEFAULT_CATAN_CONFIG.hexes;
const topology = buildTopology(hexes);
/** From the middle of a hex to the middle of one of its sides. */
const APOTHEM = (SIZE * Math.sqrt(3)) / 2;

/** The edges with a hex on one side only: where a port can be. */
const coast = topology.edges.filter((edge) => {
  const [a, b] = topology.edgeVertices[edge] as [string, string];
  const shared = (topology.vertexHexes[a] ?? []).filter((hex) =>
    (topology.vertexHexes[b] ?? []).includes(hex),
  );
  return shared.length === 1;
});

describe('CATAN board layout', () => {
  it('floats a port straight out to sea from any edge of the coast', () => {
    expect(coast).toHaveLength(30);
    for (const edge of coast) {
      const [a, b] = edgePoints(edge);
      const middle = towards(a, b, 0.5);
      const spot = portSpot(edge, hexes, 25);
      expect(Math.hypot(spot.x - middle.x, spot.y - middle.y)).toBeCloseTo(25);
      // Out to sea: not over any tile of the island.
      for (const centre of hexes.map(hexCentre)) {
        expect(Math.hypot(spot.x - centre.x, spot.y - centre.y)).toBeGreaterThan(APOTHEM);
      }
    }
  });

  it('has a drawing for every development card', () => {
    for (const icon of Object.values(CARD_ICON)) expect(ICON_PATHS[icon]).toBeTruthy();
  });
});

describe('CATAN hand changes', () => {
  it('reports what a hand gained and lost between two states', () => {
    const before = { brick: 2, wood: 0, wool: 1, wheat: 3, ore: 0 };
    const after = { brick: 1, wood: 0, wool: 1, wheat: 5, ore: 1 };
    expect(handDifference(before, after)).toEqual({
      brick: -1,
      wood: 0,
      wool: 0,
      wheat: 2,
      ore: 1,
    });
  });
});

describe('CATAN text', () => {
  it('names amounts and trades in the language asked for', () => {
    expect(CATAN_TEXT.en.tradeFor(4, 'wheat', 'ore')).toBe('Trade 4 wheat for 1 ore');
    expect(CATAN_TEXT.vi.tradeFor(4, 'wheat', 'ore')).toBe('Đổi 4 lúa lấy 1 quặng');
    expect(CATAN_TEXT.en.status.freeRoads(1)).toBe('Place 1 free road.');
    expect(CATAN_TEXT.vi.status.waitingDiscard(['An', 'Bình'])).toBe(
      'Xúc xắc ra 7. Đang chờ An, Bình bỏ bài.',
    );
  });
});
