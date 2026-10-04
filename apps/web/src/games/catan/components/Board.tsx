import { hexKey, type CatanView } from '@bgp/game-catan';
import { useMemo, type KeyboardEvent } from 'react';
import {
  RESOURCE_FILL,
  RESOURCE_LABEL,
  SIZE,
  TERRAIN_FILL,
  TERRAIN_LABEL,
  boundsOf,
  edgePoints,
  harborLabel,
  hexCentre,
  hexPoints,
  pips,
  towards,
  vertexPoint,
  type Point,
} from '../layout';

/** Room around the island for the harbors. */
const PADDING = SIZE * 1.5;
const TOKEN_RADIUS = 13;
/** How far a road stops short of the corners at its ends, as a share of the edge. */
const ROAD_INSET = 0.16;
const SETTLEMENT = '-7,6 -7,-2 0,-9 7,-2 7,6';
const CITY = '-11,7 -11,-3 -3,-3 -3,-8 3,-13 9,-8 9,7';

interface BoardProps {
  view: Pick<CatanView, 'board' | 'buildings' | 'roads'>;
  colors: Record<string, string>;
  /** Who owns a piece, for its tooltip. */
  nameOf(playerId: string): string;
  /** What the viewer may click right now. */
  vertexTargets?: readonly string[];
  edgeTargets?: readonly string[];
  hexTargets?: readonly string[];
  /** A hex picked but not sent yet: the robber's destination while its victim is chosen. */
  selectedHex?: string | null;
  onVertex?(vertex: string): void;
  onEdge?(edge: string): void;
  onHex?(hex: string): void;
}

/** What makes an SVG shape behave like a button for the mouse and the keyboard. */
function clickable(label: string, onActivate: () => void) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: onActivate,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      onActivate();
    },
  };
}

const at = (point: Point) => `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`;

export function Board({
  view,
  colors,
  nameOf,
  vertexTargets = [],
  edgeTargets = [],
  hexTargets = [],
  selectedHex = null,
  onVertex,
  onEdge,
  onHex,
}: BoardProps) {
  const { hexes, harbors, robber } = view.board;
  const bounds = useMemo(() => boundsOf(hexes, PADDING), [hexes]);

  return (
    <svg
      className="catan-board"
      role="group"
      aria-label="The island"
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
    >
      {hexes.map((hex) => {
        const centre = hexCentre(hex);
        const key = hexKey(hex);
        const red = hex.number === 6 || hex.number === 8;
        const description =
          hex.number === null
            ? TERRAIN_LABEL[hex.terrain]
            : `${TERRAIN_LABEL[hex.terrain]}, produces on ${hex.number}`;
        return (
          <g key={key} className="catan-hex">
            <title>{key === robber ? `${description}. The robber is here.` : description}</title>
            <polygon points={hexPoints(centre, SIZE - 1)} fill={TERRAIN_FILL[hex.terrain]} />
            {hex.number !== null && (
              <g transform={at(centre)} className={red ? 'catan-token red' : 'catan-token'}>
                <circle r={TOKEN_RADIUS} />
                <text y={2}>{hex.number}</text>
                {Array.from({ length: pips(hex.number) }, (_, index) => (
                  <circle
                    key={index}
                    className="catan-pip"
                    cx={(index - (pips(hex.number as number) - 1) / 2) * 3.6}
                    cy={8.5}
                    r={1.1}
                  />
                ))}
              </g>
            )}
          </g>
        );
      })}

      {harbors.map((harbor) => {
        const [a, b] = edgePoints(harbor.edge);
        const middle = towards(a, b, 0.5);
        // Out to sea: away from the middle of the island.
        const spot = towards(bounds.centre, middle, 1.24);
        const label =
          harbor.type === 'any'
            ? 'Harbor: any 3 of a kind for 1'
            : `Harbor: 2 ${harbor.type} for 1`;
        return (
          <g key={harbor.edge} className="catan-harbor">
            <title>{label}</title>
            <line x1={a.x} y1={a.y} x2={spot.x} y2={spot.y} />
            <line x1={b.x} y1={b.y} x2={spot.x} y2={spot.y} />
            <g transform={at(spot)}>
              <circle
                r={11}
                fill={harbor.type === 'any' ? undefined : RESOURCE_FILL[harbor.type]}
              />
              <text y={-0.5}>{harborLabel(harbor.type)}</text>
              <text className="catan-harbor-kind" y={6.5}>
                {harbor.type === 'any' ? 'any' : RESOURCE_LABEL[harbor.type].toLowerCase()}
              </text>
            </g>
          </g>
        );
      })}

      {hexTargets.map((key) => {
        const hex = hexes.find((candidate) => hexKey(candidate) === key);
        if (!hex) return null;
        return (
          <polygon
            key={key}
            className="catan-target hex"
            points={hexPoints(hexCentre(hex), SIZE - 6)}
            {...clickable(`Move the robber to the ${TERRAIN_LABEL[hex.terrain]} at ${key}`, () =>
              onHex?.(key),
            )}
          />
        );
      })}

      {Object.entries(view.roads).map(([edge, playerId]) => {
        const [a, b] = edgePoints(edge);
        const from = towards(a, b, ROAD_INSET);
        const to = towards(b, a, ROAD_INSET);
        return (
          <g key={edge} className="catan-road">
            <title>{`Road of ${nameOf(playerId)}`}</title>
            <line className="catan-road-edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={colors[playerId]} />
          </g>
        );
      })}

      {edgeTargets.map((edge) => {
        const [a, b] = edgePoints(edge);
        const from = towards(a, b, ROAD_INSET);
        const to = towards(b, a, ROAD_INSET);
        return (
          <g
            key={edge}
            className="catan-target edge"
            {...clickable('Build a road here', () => onEdge?.(edge))}
          >
            <line className="catan-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          </g>
        );
      })}

      {Object.entries(view.buildings).map(([vertex, building]) => (
        <g key={vertex} className="catan-building" transform={at(vertexPoint(vertex))}>
          <title>{`${building.kind === 'city' ? 'City' : 'Settlement'} of ${nameOf(building.playerId)}`}</title>
          <polygon
            points={building.kind === 'city' ? CITY : SETTLEMENT}
            fill={colors[building.playerId]}
          />
        </g>
      ))}

      {vertexTargets.map((vertex) => {
        const point = vertexPoint(vertex);
        const upgrade = view.buildings[vertex] !== undefined;
        return (
          <circle
            key={vertex}
            className="catan-target vertex"
            cx={point.x}
            cy={point.y}
            r={upgrade ? 13 : 9}
            {...clickable(upgrade ? 'Build a city here' : 'Build a settlement here', () =>
              onVertex?.(vertex),
            )}
          />
        );
      })}

      {hexes
        .filter((hex) => hexKey(hex) === robber || hexKey(hex) === selectedHex)
        .map((hex) => {
          const centre = hexCentre(hex);
          const pending = hexKey(hex) !== robber;
          return (
            <g
              key={hexKey(hex)}
              className={pending ? 'catan-robber pending' : 'catan-robber'}
              transform={at({ x: centre.x, y: centre.y - 22 })}
            >
              <circle cy={-4} r={4.5} />
              <path d="M-6 8a6 8 0 0 1 12 0z" />
            </g>
          );
        })}
    </svg>
  );
}
