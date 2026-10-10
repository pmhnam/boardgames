import type { AnimalCard, HabitatCell } from '@bgp/game-harmonies';
import type { CSSProperties, ReactNode } from 'react';
import {
  TOKEN_FILL,
  TOKEN_SHADE,
  animalIcon,
  backToFront,
  boundsOf,
  cardTint,
  hexCentre,
  type DiagramToken,
} from '../layout';
import { useHarmoniesText } from '../useHarmoniesText';
import { Icon } from './Icon';
import { AnimalCube, TokenStack, stackTopY, tokenThickness } from './TokenStack';

const SIZE = 13;
const TOKEN = 12;
const MAX_HEIGHT = 3;

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
      // The lower token of a building may be a mountain, a trunk or another building token.
      return ['any', 'building'];
  }
}

export function cardTitle(card: AnimalCard): string {
  return card.name ?? (card.sourceId === undefined ? card.id : `#${card.sourceId}`);
}

/**
 * The habitat as a small diagram. Every cell is drawn as the actual stack of tokens it needs,
 * so a two-token building or a three-token tree cannot be mistaken for a single token. The
 * cube marks where the animal goes.
 */
function HabitatDiagram({ card }: { card: AnimalCard }) {
  const text = useHarmoniesText();
  const { cells } = card.habitat;
  const bounds = boundsOf(cells, SIZE, 2);
  const headroom = tokenThickness(TOKEN) * (MAX_HEIGHT - 0.5) + 3;
  const slot = cells.find((cell) => cell.animalSlot);
  const summary = text.habitat(
    slot ? text.habitatCell(slot) : '?',
    cells.filter((cell) => !cell.animalSlot).map(text.habitatCell),
  );

  return (
    <svg
      className="habitat"
      role="img"
      aria-label={summary}
      height={72}
      viewBox={`${bounds.minX} ${bounds.minY - headroom} ${bounds.width} ${bounds.height + headroom}`}
    >
      <title>{summary}</title>
      {backToFront(cells, SIZE).map((cell) => {
        const { x, y } = hexCentre(cell, SIZE);
        const stack = stackOf(cell);
        const topY = stackTopY(y, TOKEN, stack.length);
        return (
          <g key={`${cell.q},${cell.r}`}>
            <TokenStack x={x} y={y} size={TOKEN} stack={stack} glyphs={!cell.animalSlot} />
            {cell.animalSlot && <AnimalCube x={x} y={topY} size={4.2} />}
            {stack.length > 1 && (
              <g className="hex-height small" aria-hidden="true">
                <circle cx={x + TOKEN * 0.6} cy={topY + TOKEN * 0.55} r={3.6} />
                <text x={x + TOKEN * 0.6} y={topY + TOKEN * 0.55}>
                  {stack.length}
                </text>
              </g>
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
  /** Lying down, the habitat beside the rest: for a column of cards, where height is short. */
  landscape?: boolean;
  action?: ReactNode;
}

export function AnimalCardView({
  card,
  cubesPlaced,
  selected,
  compact,
  landscape,
  action,
}: AnimalCardViewProps) {
  const text = useHarmoniesText();
  const tint = cardTint(card);
  const classes = [
    'animal-card',
    selected && 'selected',
    compact && 'compact',
    landscape && 'landscape',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={classes}
      style={{ '--tint': TOKEN_FILL[tint], '--tint-shade': TOKEN_SHADE[tint] } as CSSProperties}
    >
      <div className="animal-card-head">
        <span className="animal-portrait">
          <Icon name={animalIcon(card)} />
        </span>
        <strong title={cardTitle(card)}>{cardTitle(card)}</strong>
      </div>
      <HabitatDiagram card={card} />
      <ol className="card-points" aria-label={text.cardPoints}>
        {card.pointsByAnimalsPlaced.slice(1).map((points, index) => (
          <li
            key={index}
            className={
              cubesPlaced === undefined || index >= cubesPlaced
                ? undefined
                : index === cubesPlaced - 1
                  ? 'done latest'
                  : 'done'
            }
          >
            {points}
          </li>
        ))}
      </ol>
      {action && <div className="animal-card-action">{action}</div>}
    </div>
  );
}
