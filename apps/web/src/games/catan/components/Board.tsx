import { TERRAINS, TERRAIN_RESOURCE, hexKey, type CatanView, type Terrain } from '@bgp/game-catan';
import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { useHints } from '../hints';
import {
  RESOURCE_FILL,
  RESOURCE_INK,
  SIZE,
  TERRAIN_ART,
  boundsOf,
  edgePoints,
  portLabel,
  portSpot,
  hexCentre,
  hexPoints,
  pips,
  towards,
  vertexPoint,
  type Point,
} from '../layout';
import { useCatanText } from '../useCatanText';
import { Glyph } from './Icon';
import { HintText, useTips } from './Tip';

/** Sea around the island: enough for the ports, and no more, so the tiles stay large. */
const PAD_X = SIZE * 1.05;
const PAD_Y = SIZE * 0.85;
/** How far out to sea a port's marker floats from its edge. */
const PORT_REACH = SIZE * 0.62;
const TOKEN_RADIUS = 13;
/** A tile's artwork takes its top half, and its number token sits just below the middle. */
const ART_RISE = 19;
const TOKEN_DROP = 8;
/** How far a road stops short of the corners at its ends, as a share of the edge. */
const ROAD_INSET = 0.16;
const SETTLEMENT = '-7.5,7 -7.5,-1.5 0,-9 7.5,-1.5 7.5,7';
const SETTLEMENT_ROOF = '-7.5,-1.5 0,-9 7.5,-1.5';
const CITY = '-11,8 -11,-2 -3,-2 -3,-8 3,-14 9,-8 9,8';
const CITY_ROOF = '-3,-8 3,-14 9,-8';
/** The marker of a port that takes any resource: plain, where the others wear their resource. */
const PORT_FILL = '#fbf3dc';
const PORT_INK = '#3d2a12';

/** What grows on a tile, drawn around its own middle in a tone of the tile's colour. */
const ART: Record<Terrain, (ink: string) => ReactNode> = {
  forest: (ink) => (
    <>
      <Glyph name="pine" size={20} x={-12} y={3} fill={ink} opacity={0.7} />
      <Glyph name="pine" size={20} x={12} y={3} fill={ink} opacity={0.7} />
      <Glyph name="pine" size={26} y={-1} fill={ink} />
    </>
  ),
  hills: (ink) => <Glyph name="brick" size={31} fill={ink} />,
  pasture: (ink) => <Glyph name="wool" size={28} fill={ink} className="catan-art-outlined" />,
  fields: (ink) => <Glyph name="wheat" size={27} fill={ink} />,
  mountains: (ink) => <Glyph name="peaks" size={36} fill={ink} />,
  desert: (ink) => <Glyph name="cactus" size={30} fill={ink} />,
};

interface BoardProps {
  view: Pick<CatanView, 'board' | 'buildings' | 'roads'>;
  colors: Record<string, string>;
  /** Who owns a piece, for its hint. */
  nameOf(playerId: string): string;
  /** The total of the dice this turn: the tiles it pays out on are lit. */
  rolled?: number | null;
  /** The viewer's own colour, shown on the places they may build. */
  accent?: string;
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

function RobberPiece() {
  return (
    <>
      <ellipse className="catan-shadow" cy={11} rx={9.5} ry={2.8} />
      <circle r={11} />
      <Glyph name="robber" size={15} />
    </>
  );
}

export function Board({
  view,
  colors,
  nameOf,
  rolled = null,
  accent = '#ffffff',
  vertexTargets = [],
  edgeTargets = [],
  hexTargets = [],
  selectedHex = null,
  onVertex,
  onEdge,
  onHex,
}: BoardProps) {
  const text = useCatanText();
  const hints = useHints();
  const tips = useTips();
  const { hexes, ports, robber } = view.board;
  const bounds = useMemo(() => boundsOf(hexes, PAD_X, PAD_Y), [hexes]);
  /** Where the robber stands on a tile: over its artwork, leaving the number in sight. */
  const robberSpot = (key: string): Point | null => {
    const hex = hexes.find((candidate) => hexKey(candidate) === key);
    if (!hex) return null;
    const centre = hexCentre(hex);
    return { x: centre.x, y: centre.y - (hex.number === null ? 0 : ART_RISE) };
  };
  const robberAt = robberSpot(robber);
  const pendingAt = selectedHex !== null && selectedHex !== robber ? robberSpot(selectedHex) : null;

  return (
    <svg
      className="catan-board"
      role="group"
      aria-label={text.island}
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
    >
      <defs>
        {TERRAINS.map((terrain) => (
          <linearGradient key={terrain} id={`catan-terrain-${terrain}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={TERRAIN_ART[terrain].light} />
            <stop offset="1" stopColor={TERRAIN_ART[terrain].dark} />
          </linearGradient>
        ))}
        <radialGradient id="catan-light" cx="0.3" cy="0.18" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="catan-token-face" cx="0.4" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#fffaea" />
          <stop offset="1" stopColor="#ead9ae" />
        </radialGradient>
        <pattern id="catan-speckle" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2.5" r="0.7" />
          <circle cx="6.5" cy="6.8" r="0.55" />
        </pattern>
        <pattern
          id="catan-furrows"
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(24)"
        >
          <line x1="0" y1="0" x2="0" y2="6" />
        </pattern>
        <filter id="catan-island-shadow" x="-10%" y="-10%" width="120%" height="125%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#07243f" floodOpacity="0.5" />
        </filter>
      </defs>

      <g className="catan-shallows">
        {hexes.map((hex) => (
          <polygon key={hexKey(hex)} points={hexPoints(hexCentre(hex), SIZE + 12)} />
        ))}
      </g>
      <g className="catan-coast" filter="url(#catan-island-shadow)">
        {hexes.map((hex) => (
          <polygon key={hexKey(hex)} points={hexPoints(hexCentre(hex), SIZE + 4)} />
        ))}
      </g>

      {hexes.map((hex) => {
        const centre = hexCentre(hex);
        const key = hexKey(hex);
        const outline = hexPoints({ x: 0, y: 0 }, SIZE - 1.2);
        const classes = ['catan-token'];
        if (hex.number === 6 || hex.number === 8) classes.push('red');
        if (key === robber) classes.push('blocked');
        else if (hex.number === rolled) classes.push('rolled');
        const description =
          hex.number === null
            ? text.terrain[hex.terrain]
            : text.producesOn(hex.terrain, hex.number);
        const resource = TERRAIN_RESOURCE[hex.terrain];
        const hint =
          hex.number === null || resource === null
            ? hints.desert
            : hints.hex(hex.terrain, resource, hex.number, pips(hex.number));
        return (
          <g
            key={key}
            className={`catan-hex ${hex.terrain}`}
            transform={at(centre)}
            role="img"
            aria-label={key === robber ? text.robberHere(description) : description}
            {...tips.anchor(`hex:${key}`)}
          >
            {tips.bubble(
              `hex:${key}`,
              <>
                <HintText hint={hint} />
                {key === robber && <span className="catan-tip-warn">{hints.robberHere}</span>}
              </>,
            )}
            <polygon
              className="catan-hex-ground"
              points={outline}
              fill={`url(#catan-terrain-${hex.terrain})`}
            />
            <polygon
              className="catan-hex-texture"
              points={outline}
              fill={hex.terrain === 'fields' ? 'url(#catan-furrows)' : 'url(#catan-speckle)'}
            />
            <polygon className="catan-hex-light" points={outline} fill="url(#catan-light)" />
            <polygon className="catan-hex-bevel" points={hexPoints({ x: 0, y: 0 }, SIZE - 3.6)} />
            <g
              className="catan-art"
              transform={hex.number === null ? 'scale(1.3)' : `translate(0 ${-ART_RISE})`}
            >
              {ART[hex.terrain](TERRAIN_ART[hex.terrain].ink)}
            </g>
            {hex.number !== null && (
              <g transform={`translate(0 ${TOKEN_DROP})`} className={classes.join(' ')}>
                <ellipse className="catan-shadow" cy={2.2} rx={TOKEN_RADIUS} ry={TOKEN_RADIUS} />
                <circle
                  className="catan-token-face"
                  r={TOKEN_RADIUS}
                  fill="url(#catan-token-face)"
                />
                <text y={2.4}>{hex.number}</text>
                {Array.from({ length: pips(hex.number) }, (_, index) => (
                  <circle
                    key={index}
                    className="catan-pip"
                    cx={(index - (pips(hex.number as number) - 1) / 2) * 3.5}
                    cy={8.4}
                    r={1.15}
                  />
                ))}
              </g>
            )}
          </g>
        );
      })}

      {ports.map((port) => {
        const [a, b] = edgePoints(port.edge);
        const spot = portSpot(port.edge, hexes, PORT_REACH);
        const label = port.type === 'any' ? text.portAny : text.portOf(port.type);
        return (
          <g
            key={port.edge}
            className="catan-port"
            role="img"
            aria-label={label}
            {...tips.anchor(`port:${port.edge}`)}
          >
            {tips.bubble(`port:${port.edge}`, <HintText hint={hints.port(port.type)} />)}
            {[a, b].map((corner, index) => (
              <g key={index}>
                <line className="catan-pier" x1={corner.x} y1={corner.y} x2={spot.x} y2={spot.y} />
                <line
                  className="catan-pier-top"
                  x1={corner.x}
                  y1={corner.y}
                  x2={spot.x}
                  y2={spot.y}
                />
              </g>
            ))}
            <g transform={at(spot)}>
              <ellipse className="catan-shadow" cy={1.8} rx={10.5} ry={10.5} />
              {port.type === 'any' ? (
                <g style={{ color: PORT_INK }}>
                  <circle className="catan-port-buoy" r={10.5} fill={PORT_FILL} />
                  <text className="catan-port-rate" y={1.4}>
                    {portLabel(port.type)}
                  </text>
                  <text className="catan-port-kind" y={6.8}>
                    {text.any}
                  </text>
                </g>
              ) : (
                <g style={{ color: RESOURCE_INK[port.type] }}>
                  <circle className="catan-port-buoy" r={10.5} fill={RESOURCE_FILL[port.type]} />
                  <Glyph name={port.type} size={11.5} y={-2.6} fill="currentColor" />
                  <text className="catan-port-kind" y={7.2}>
                    {portLabel(port.type)}
                  </text>
                </g>
              )}
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
            points={hexPoints(hexCentre(hex), SIZE - 4)}
            {...clickable(text.moveRobberTo(hex.terrain, key), () => onHex?.(key))}
          />
        );
      })}

      {Object.entries(view.roads).map(([edge, playerId]) => {
        const [a, b] = edgePoints(edge);
        const from = towards(a, b, ROAD_INSET);
        const to = towards(b, a, ROAD_INSET);
        const line = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
        const hint = hints.roadOf(nameOf(playerId));
        return (
          <g
            key={edge}
            className="catan-road"
            role="img"
            aria-label={hint.title}
            {...tips.anchor(`road:${edge}`)}
          >
            {tips.bubble(`road:${edge}`, <HintText hint={hint} />)}
            <line className="catan-road-edge" {...line} />
            <line className="catan-road-body" {...line} stroke={colors[playerId]} />
            <line className="catan-road-shine" {...line} />
          </g>
        );
      })}

      {edgeTargets.map((edge) => {
        const [a, b] = edgePoints(edge);
        const from = towards(a, b, ROAD_INSET);
        const to = towards(b, a, ROAD_INSET);
        const line = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
        return (
          <g
            key={edge}
            className="catan-target edge"
            {...clickable(text.buildRoadHere, () => onEdge?.(edge))}
          >
            <line className="catan-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
            <line className="catan-target-edge" {...line} />
            <line className="catan-target-bed" {...line} />
            <line className="catan-target-core" {...line} stroke={accent} />
          </g>
        );
      })}

      {Object.entries(view.buildings).map(([vertex, building]) => {
        const city = building.kind === 'city';
        const owner = nameOf(building.playerId);
        const hint = city ? hints.cityOf(owner) : hints.settlementOf(owner);
        return (
          <g
            key={vertex}
            className="catan-building"
            transform={at(vertexPoint(vertex))}
            role="img"
            aria-label={hint.title}
            {...tips.anchor(`building:${vertex}`)}
          >
            {tips.bubble(`building:${vertex}`, <HintText hint={hint} />)}
            {/* Keyed by kind, so a settlement growing into a city arrives like a new piece. */}
            <g key={building.kind} className="catan-pop">
              <ellipse className="catan-shadow" cy={7.4} rx={city ? 12.5 : 9.5} ry={2.8} />
              <polygon
                className="catan-piece"
                points={city ? CITY : SETTLEMENT}
                fill={colors[building.playerId]}
              />
              <polygon className="catan-piece-shade" points={city ? CITY_ROOF : SETTLEMENT_ROOF} />
              {city ? (
                <>
                  <rect className="catan-piece-shade" x={-11} y={-2} width={8} height={2.4} />
                  <rect className="catan-piece-window" x={1.4} y={-5.4} width={3.2} height={4.4} />
                  <rect className="catan-piece-window" x={-8.6} y={2.6} width={3.2} height={3.4} />
                </>
              ) : (
                <rect className="catan-piece-window" x={-1.6} y={1.4} width={3.2} height={5.6} />
              )}
            </g>
          </g>
        );
      })}

      {vertexTargets.map((vertex) => {
        const upgrade = view.buildings[vertex] !== undefined;
        return (
          <g
            key={vertex}
            className={upgrade ? 'catan-target vertex upgrade' : 'catan-target vertex'}
            transform={at(vertexPoint(vertex))}
            {...clickable(upgrade ? text.buildCityHere : text.buildSettlementHere, () =>
              onVertex?.(vertex),
            )}
          >
            <circle className="catan-hit" r={15} />
            <circle className="catan-target-ring" r={upgrade ? 14.5 : 8} />
            {!upgrade && <circle className="catan-target-dot" r={4} fill={accent} />}
          </g>
        );
      })}

      {robberAt && (
        // One piece that slides: its place is a style, so the move can be animated.
        <g
          className="catan-robber"
          style={{ transform: `translate(${robberAt.x.toFixed(1)}px, ${robberAt.y.toFixed(1)}px)` }}
        >
          <RobberPiece />
        </g>
      )}
      {pendingAt && (
        <g className="catan-robber pending" transform={at(pendingAt)}>
          <RobberPiece />
        </g>
      )}
    </svg>
  );
}
