import type { AnimalCard, TerrainRequirement } from '@bgp/game-harmonies';
import type { ReactNode } from 'react';
import { TERRAIN_FILL, TERRAIN_LABEL, boundsOf, hexCentre, hexPoints } from '../layout';

const SIZE = 13;

function describe(requirement: TerrainRequirement): string {
  const height = requirement.height === undefined ? '' : ` (height ${requirement.height})`;
  return `${TERRAIN_LABEL[requirement.kind]}${height}`;
}

/** The habitat as a small diagram: the marked cell is where the animal cube goes. */
function HabitatDiagram({ card }: { card: AnimalCard }) {
  const cells = [
    { offset: { q: 0, r: 0 }, requires: card.cubeOn, isCube: true },
    ...card.habitat.map((cell) => ({ ...cell, isCube: false })),
  ];
  const bounds = boundsOf(
    cells.map((cell) => cell.offset),
    SIZE,
    2,
  );
  const summary = `Animal on ${describe(card.cubeOn)}, next to ${card.habitat
    .map((cell) => describe(cell.requires))
    .join(' and ')}`;

  return (
    <svg
      className="habitat"
      role="img"
      aria-label={summary}
      height={64}
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
    >
      <title>{summary}</title>
      {cells.map((cell, index) => {
        const { x, y } = hexCentre(cell.offset, SIZE);
        return (
          <g key={index}>
            <polygon
              className="hex-token"
              points={hexPoints(x, y, SIZE - 1)}
              fill={TERRAIN_FILL[cell.requires.kind]}
            />
            {cell.isCube && (
              <rect className="hex-cube" x={x - 4} y={y - 4} width={8} height={8} rx={1} />
            )}
            {cell.requires.height !== undefined && (
              <text className="hex-height small" x={x + 4} y={y + 9}>
                {cell.requires.height}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

interface AnimalCardViewProps {
  card: AnimalCard;
  /** Omitted for cards still in the face-up row. */
  cubesPlaced?: number;
  selected?: boolean;
  action?: ReactNode;
}

export function AnimalCardView({ card, cubesPlaced, selected, action }: AnimalCardViewProps) {
  return (
    <div className={selected ? 'animal-card selected' : 'animal-card'}>
      <strong>{card.name}</strong>
      <HabitatDiagram card={card} />
      <ol className="card-points" aria-label="Points by number of animals placed">
        {card.points.map((points, index) => (
          <li
            key={index}
            className={cubesPlaced !== undefined && index < cubesPlaced ? 'done' : undefined}
          >
            {points}
          </li>
        ))}
      </ol>
      {action}
    </div>
  );
}
