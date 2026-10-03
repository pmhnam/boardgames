import type { AnimalCard, HabitatCell, TokenColor } from '@bgp/game-harmonies';
import type { ReactNode } from 'react';
import { TOKEN_FILL, boundsOf, hexCentre, hexPoints } from '../layout';

const SIZE = 13;
/** How far each token in a stack is drawn above the one below it. */
const LIFT = 4;
const MAX_HEIGHT = 3;

/** The lower token of a building may be a mountain, a trunk or another building token. */
type DiagramToken = TokenColor | 'any-base';

/** The tokens a habitat cell asks for, bottom to top, exactly as they must be stacked. */
function stackOf(cell: HabitatCell): DiagramToken[] {
  switch (cell.terrain) {
    case 'WATER':
      return ['water'];
    case 'FIELD':
      return ['field'];
    case 'MOUNTAIN':
      return Array<DiagramToken>(cell.height).fill('mountain');
    case 'TREE':
      return [...Array<DiagramToken>(cell.height - 1).fill('trunk'), 'leaf'];
    case 'BUILDING':
      return ['any-base', 'building'];
  }
}

function describe(cell: HabitatCell): string {
  switch (cell.terrain) {
    case 'WATER':
      return 'water';
    case 'FIELD':
      return 'a field';
    case 'MOUNTAIN':
      return `a mountain ${cell.height} high`;
    case 'TREE':
      return `a tree ${cell.height} high`;
    case 'BUILDING':
      return 'a building (a red token on a grey, brown or red one)';
  }
}

export function cardTitle(card: AnimalCard): string {
  return card.name ?? (card.sourceId === undefined ? card.id : `#${card.sourceId}`);
}

/**
 * The habitat as a small diagram. Every cell is drawn as the actual stack of tokens it needs,
 * so a two-token building or a three-token tree cannot be mistaken for a single token. The
 * marked cell is where the animal goes.
 */
function HabitatDiagram({ card }: { card: AnimalCard }) {
  const { cells } = card.habitat;
  const bounds = boundsOf(cells, SIZE, 2 + MAX_HEIGHT * LIFT);
  const slot = cells.find((cell) => cell.animalSlot);
  const summary = `Animal on ${slot ? describe(slot) : '?'}, next to ${cells
    .filter((cell) => !cell.animalSlot)
    .map(describe)
    .join(' and ')}`;
  // Back rows first, so stacks in front overlap the ones behind.
  const drawOrder = [...cells].sort((a, b) => hexCentre(a, SIZE).y - hexCentre(b, SIZE).y);

  return (
    <svg
      className="habitat"
      role="img"
      aria-label={summary}
      height={72}
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
    >
      <title>{summary}</title>
      {drawOrder.map((cell) => {
        const { x, y } = hexCentre(cell, SIZE);
        const stack = stackOf(cell);
        const topY = y - (stack.length - 1) * LIFT;
        return (
          <g key={`${cell.q},${cell.r}`}>
            {stack.map((token, level) => (
              <polygon
                key={level}
                className={token === 'any-base' ? 'hex-token hex-any-base' : 'hex-token'}
                points={hexPoints(x, y - level * LIFT, SIZE - 1)}
                fill={token === 'any-base' ? undefined : TOKEN_FILL[token]}
              />
            ))}
            {cell.animalSlot && (
              <rect className="hex-cube" x={x - 4} y={topY - 4} width={8} height={8} rx={1} />
            )}
            {stack.length > 1 && (
              <text className="hex-height small" x={x + 5} y={topY + 9}>
                {stack.length}
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
  /** A smaller card, for other players' boards. */
  compact?: boolean;
  action?: ReactNode;
}

export function AnimalCardView({
  card,
  cubesPlaced,
  selected,
  compact,
  action,
}: AnimalCardViewProps) {
  const classes = ['animal-card', selected && 'selected', compact && 'compact']
    .filter(Boolean)
    .join(' ');
  return (
    <div className={classes}>
      <strong title={cardTitle(card)}>{cardTitle(card)}</strong>
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
      {action && <div className="animal-card-action">{action}</div>}
    </div>
  );
}
