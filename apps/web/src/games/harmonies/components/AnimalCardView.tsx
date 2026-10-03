import type { AnimalCard, HabitatCell } from '@bgp/game-harmonies';
import type { ReactNode } from 'react';
import { CARD_TERRAIN_FILL, CARD_TERRAIN_LABEL, boundsOf, hexCentre, hexPoints } from '../layout';

const SIZE = 13;

function describe(cell: HabitatCell): string {
  const height = cell.terrain === 'TREE' || cell.terrain === 'MOUNTAIN' ? ` ${cell.height}` : '';
  return `${CARD_TERRAIN_LABEL[cell.terrain]}${height}`;
}

export function cardTitle(card: AnimalCard): string {
  return card.name ?? (card.sourceId === undefined ? card.id : `#${card.sourceId}`);
}

/** The habitat as a small diagram: the marked cell is where the animal cube goes. */
function HabitatDiagram({ card }: { card: AnimalCard }) {
  const { cells } = card.habitat;
  const bounds = boundsOf(cells, SIZE, 2);
  const slot = cells.find((cell) => cell.animalSlot);
  const summary = `Animal on ${slot ? describe(slot) : '?'}, with ${cells
    .filter((cell) => !cell.animalSlot)
    .map(describe)
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
        const { x, y } = hexCentre(cell, SIZE);
        const showHeight = cell.terrain === 'TREE' || cell.terrain === 'MOUNTAIN';
        return (
          <g key={index}>
            <polygon
              className="hex-token"
              points={hexPoints(x, y, SIZE - 1)}
              fill={CARD_TERRAIN_FILL[cell.terrain]}
            />
            {cell.animalSlot && (
              <rect className="hex-cube" x={x - 4} y={y - 4} width={8} height={8} rx={1} />
            )}
            {showHeight && (
              <text className="hex-height small" x={x + 4} y={y + 9}>
                {cell.height}
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
      <strong>{cardTitle(card)}</strong>
      <HabitatDiagram card={card} />
      <ol className="card-points" aria-label="Points by number of animals placed">
        {card.pointsByAnimalsPlaced.slice(1).map((points, index) => (
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
