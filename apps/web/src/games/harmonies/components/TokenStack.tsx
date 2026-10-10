import {
  TOKEN_FILL,
  TOKEN_INK,
  TOKEN_SHADE,
  hexPoints,
  hexWall,
  topGlyph,
  type DiagramToken,
} from '../layout';
import { Glyph } from './Icon';

/** How thick a token is, as a share of its size. */
const THICKNESS = 0.26;

export function tokenThickness(size: number): number {
  return size * THICKNESS;
}

/**
 * Where the top face of a stack sits: each token lifts the next by its own thickness. An
 * empty cell's "top" is the ground itself.
 */
export function stackTopY(y: number, size: number, height: number): number {
  return height === 0 ? y : y + tokenThickness(size) * (0.5 - height);
}

interface TokenStackProps {
  x: number;
  y: number;
  /** The radius of a token. */
  size: number;
  /** Bottom to top. */
  stack: readonly DiagramToken[];
  /** A class for the top token only, e.g. one that drops it into place. */
  topClassName?: string;
  /** Left out for stacks too small to print on. */
  glyphs?: boolean;
}

/**
 * A stack of tokens as it stands on the table: every token shows its edge, so a height can be
 * counted at a glance, and the top one carries a picture of what the stack has become.
 */
export function TokenStack({ x, y, size, stack, topClassName, glyphs = true }: TokenStackProps) {
  const thickness = tokenThickness(size);
  const glyph = glyphs ? topGlyph(stack) : null;

  return (
    <>
      {stack.map((token, level) => {
        const faceY = stackTopY(y, size, level + 1);
        const isTop = level === stack.length - 1;
        const any = token === 'any';
        return (
          <g key={level} className={isTop ? topClassName : undefined}>
            <polygon
              className={any ? 'token-wall any' : 'token-wall'}
              points={hexWall(x, faceY, size, thickness)}
              fill={any ? undefined : TOKEN_SHADE[token]}
            />
            <polygon
              className="token-wall-front"
              points={hexWall(x, faceY, size, thickness, 1, 2)}
            />
            <polygon
              className={any ? 'token-face any' : 'token-face'}
              points={hexPoints(x, faceY, size)}
              fill={any ? undefined : TOKEN_FILL[token]}
            />
            {!any && <polygon className="token-rim" points={hexPoints(x, faceY, size * 0.84)} />}
            {isTop && glyph && !any && (
              <Glyph
                className="token-glyph"
                name={glyph}
                size={size * 1.02}
                x={x}
                y={faceY}
                fill={TOKEN_INK[token]}
              />
            )}
          </g>
        );
      })}
    </>
  );
}

/** An animal, as the wooden cube the game uses for one. Stands on a face centred at x, y. */
export function AnimalCube({
  x,
  y,
  size,
  className,
}: {
  x: number;
  y: number;
  size: number;
  className?: string;
}) {
  const c = size;
  // Sits a little low, so the cube reads as standing in the middle of the face.
  const cy = y + c * 0.45;
  const point = (dx: number, dy: number) => `${(x + dx).toFixed(1)},${(cy + dy).toFixed(1)}`;
  return (
    <g className={className ? `animal-cube ${className}` : 'animal-cube'}>
      <ellipse
        className="animal-cube-shadow"
        cx={x}
        cy={cy + c * 0.55}
        rx={c * 1.05}
        ry={c * 0.42}
      />
      <polygon
        className="animal-cube-left"
        points={[point(-c, -c), point(0, -c * 0.5), point(0, c * 0.6), point(-c, c * 0.1)].join(
          ' ',
        )}
      />
      <polygon
        className="animal-cube-right"
        points={[point(c, -c), point(0, -c * 0.5), point(0, c * 0.6), point(c, c * 0.1)].join(' ')}
      />
      <polygon
        className="animal-cube-top"
        points={[point(0, -c * 1.5), point(c, -c), point(0, -c * 0.5), point(-c, -c)].join(' ')}
      />
    </g>
  );
}
