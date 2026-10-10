import { hexKey, type Hex, type PlayerBoardView, type TokenColor } from '@bgp/game-harmonies';
import { useMemo, useState } from 'react';
import { backToFront, boundsOf, grownCells, hexCentre, hexPoints } from '../layout';
import { useHarmoniesText } from '../useHarmoniesText';
import { AnimalCube, TokenStack, stackTopY, tokenThickness } from './TokenStack';

const SIZE = 30;
/** A token is a little smaller than its cell, so the board shows around it. */
const TOKEN = 25;
const CUBE = 8;
/** Room above the back row for a stack three tokens high. */
const HEADROOM = tokenThickness(TOKEN) * 2.5;

interface HexBoardProps {
  /** The board's shape, as configured for this match. */
  cells: Hex[];
  board: PlayerBoardView;
  /** The turn being played, so what a player put down stays marked until their next turn. */
  turnNumber: number;
  /** hexKeys the viewer may click right now. */
  targets?: ReadonlySet<string>;
  /** What a click would put down: shown faintly on the cell under the pointer. */
  preview?: TokenColor | 'animal';
  onSelect?(cell: Hex): void;
  label: string;
}

/**
 * The cells that changed during the board's latest turn of play. Kept from one view to the
 * next, so the three tokens of a turn stay marked together.
 */
function useFreshCells(board: PlayerBoardView, turnNumber: number): ReadonlySet<string> {
  const [seen, setSeen] = useState(board);
  const [fresh, setFresh] = useState<{ turn: number; keys: ReadonlySet<string> }>({
    turn: -1,
    keys: new Set(),
  });
  if (seen !== board) {
    setSeen(board);
    const grown = grownCells(seen, board);
    if (grown.length > 0) {
      setFresh({
        turn: turnNumber,
        keys: new Set(fresh.turn === turnNumber ? [...fresh.keys, ...grown] : grown),
      });
    }
  }
  return fresh.keys;
}

export function HexBoard({
  cells,
  board,
  turnNumber,
  targets,
  preview,
  onSelect,
  label,
}: HexBoardProps) {
  const text = useHarmoniesText();
  const fresh = useFreshCells(board, turnNumber);
  const { bounds, drawOrder } = useMemo(
    () => ({ bounds: boundsOf(cells, SIZE, 7), drawOrder: backToFront(cells, SIZE) }),
    [cells],
  );

  return (
    <svg
      className="hex-board"
      role="group"
      aria-label={label}
      viewBox={`${bounds.minX} ${bounds.minY - HEADROOM} ${bounds.width} ${bounds.height + HEADROOM}`}
    >
      {drawOrder.map((cell) => {
        const key = hexKey(cell);
        const { x, y } = hexCentre(cell, SIZE);
        const stack = board.stacks[key] ?? [];
        const topY = stackTopY(y, TOKEN, stack.length);
        const isTarget = targets?.has(key) ?? false;
        const isFresh = fresh.has(key);
        const hasAnimal = board.cubes.includes(key);
        const description =
          stack.length === 0 ? text.cellEmpty : stack.map((color) => text.token[color]).join(' + ');
        const classes = ['hex', isTarget && 'target', isFresh && 'fresh'].filter(Boolean).join(' ');

        return (
          <g
            key={key}
            className={classes}
            role={isTarget ? 'button' : undefined}
            tabIndex={isTarget ? 0 : undefined}
            aria-label={isTarget ? `${text.placeOn(description)} (${key})` : undefined}
            onClick={isTarget ? () => onSelect?.(cell) : undefined}
            onKeyDown={
              isTarget
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onSelect?.(cell);
                    }
                  }
                : undefined
            }
          >
            <title>{isFresh ? `${description} (${text.justPlayed})` : description}</title>
            <polygon className="hex-ground" points={hexPoints(x, y, SIZE - 1.5)} />
            <TokenStack
              x={x}
              y={y}
              size={TOKEN}
              stack={stack}
              topClassName={isFresh && !hasAnimal ? 'token-drop' : undefined}
            />
            {isFresh && <polygon className="hex-fresh-ring" points={hexPoints(x, topY, TOKEN)} />}
            {hasAnimal && (
              <AnimalCube
                x={x}
                y={topY}
                size={CUBE}
                className={isFresh ? 'token-drop' : undefined}
              />
            )}
            {stack.length > 1 && (
              <g className="hex-height" aria-hidden="true">
                <circle cx={x + TOKEN * 0.56} cy={topY + TOKEN * 0.5} r={6.5} />
                <text x={x + TOKEN * 0.56} y={topY + TOKEN * 0.5}>
                  {stack.length}
                </text>
              </g>
            )}
            {isTarget && (
              <>
                {preview === 'animal' && (
                  <AnimalCube x={x} y={topY} size={CUBE} className="hex-ghost" />
                )}
                {preview !== undefined && preview !== 'animal' && (
                  <g className="hex-ghost">
                    <TokenStack x={x} y={y} size={TOKEN} stack={[...stack, preview]} />
                  </g>
                )}
                {/* An empty cell lights up as a whole; a stack is ringed on top. */}
                {stack.length > 0 && (
                  <>
                    <polygon
                      className="hex-target-ring-under"
                      points={hexPoints(x, topY, TOKEN - 1)}
                    />
                    <polygon className="hex-target-ring" points={hexPoints(x, topY, TOKEN - 1)} />
                  </>
                )}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
