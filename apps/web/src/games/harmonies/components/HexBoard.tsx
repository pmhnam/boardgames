import { hexKey, type Hex, type PlayerBoardView } from '@bgp/game-harmonies';
import { useMemo } from 'react';
import { TOKEN_FILL, TOKEN_LABEL, boundsOf, hexCentre, hexPoints } from '../layout';

const SIZE = 30;
/** How far each token in a stack is drawn above the one below it. */
const LIFT = 7;

interface HexBoardProps {
  /** The board's shape, as configured for this match. */
  cells: Hex[];
  board: PlayerBoardView;
  /** hexKeys the viewer may click right now. */
  targets?: ReadonlySet<string>;
  onSelect?(cell: Hex): void;
  width: number;
  label: string;
}

export function HexBoard({ cells, board, targets, onSelect, width, label }: HexBoardProps) {
  const { bounds, drawOrder } = useMemo(
    () => ({
      bounds: boundsOf(cells, SIZE, 3 * LIFT + 2),
      // Back rows first, so taller stacks in front overlap the ones behind.
      drawOrder: [...cells].sort((a, b) => hexCentre(a, SIZE).y - hexCentre(b, SIZE).y),
    }),
    [cells],
  );

  return (
    <svg
      className="hex-board"
      role="group"
      aria-label={label}
      width={width}
      viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
    >
      {drawOrder.map((cell) => {
        const key = hexKey(cell);
        const { x, y } = hexCentre(cell, SIZE);
        const stack = board.stacks[key] ?? [];
        const topY = y - Math.max(0, stack.length - 1) * LIFT;
        const isTarget = targets?.has(key) ?? false;
        const description =
          stack.length === 0 ? 'empty' : stack.map((color) => TOKEN_LABEL[color]).join(' + ');

        return (
          <g
            key={key}
            className={isTarget ? 'hex target' : 'hex'}
            role={isTarget ? 'button' : undefined}
            tabIndex={isTarget ? 0 : undefined}
            aria-label={isTarget ? `Place on ${description} cell ${key}` : undefined}
            onClick={isTarget ? () => onSelect?.(cell) : undefined}
            onKeyDown={
              isTarget
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') onSelect?.(cell);
                  }
                : undefined
            }
          >
            <title>{description}</title>
            <polygon className="hex-ground" points={hexPoints(x, y, SIZE - 1)} />
            {stack.map((color, level) => (
              <polygon
                key={level}
                className="hex-token"
                points={hexPoints(x, y - level * LIFT, SIZE - 3)}
                fill={TOKEN_FILL[color]}
              />
            ))}
            {stack.length > 1 && (
              <text className="hex-height" x={x + SIZE * 0.45} y={topY + SIZE * 0.55}>
                {stack.length}
              </text>
            )}
            {board.cubes.includes(key) && (
              <rect className="hex-cube" x={x - 7} y={topY - 7} width={14} height={14} rx={2} />
            )}
            {isTarget && (
              <polygon className="hex-target-ring" points={hexPoints(x, topY, SIZE - 3)} />
            )}
          </g>
        );
      })}
    </svg>
  );
}
