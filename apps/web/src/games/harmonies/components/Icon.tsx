import type { SVGProps } from 'react';
import { ICON_PATHS, type IconName } from '../art/icons';

/** The grid the outlines are drawn on. */
const GRID = 512;

/** An icon that takes the colour of the text around it. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `harmonies-icon ${className}` : 'harmonies-icon'}
      viewBox={`0 0 ${GRID} ${GRID}`}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} fill="currentColor" />
    </svg>
  );
}

/** The same outline as a shape inside a board's own SVG: `size` units across, centred on x, y. */
export function Glyph({
  name,
  size,
  x = 0,
  y = 0,
  ...rest
}: { name: IconName; size: number; x?: number; y?: number } & SVGProps<SVGPathElement>) {
  return (
    <path
      d={ICON_PATHS[name]}
      transform={`translate(${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)}) scale(${(size / GRID).toFixed(4)})`}
      {...rest}
    />
  );
}
