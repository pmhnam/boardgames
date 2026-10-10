import type { SVGProps } from 'react';
import { ICON_PATHS, type IconName } from '../art/icons';

/** The grid the outlines are drawn on. */
const GRID = 512;

/** A hand of cards: the one outline the icon set has nothing close to. */
const HAND_PATH =
  'M184 56h232a32 32 0 0 1 32 32v280a32 32 0 0 1-32 32h-24V160a64 64 0 0 0-64-64H152v-8a32 32 0 0 1 32-32zM96 136h232a32 32 0 0 1 32 32v256a32 32 0 0 1-32 32H96a32 32 0 0 1-32-32V168a32 32 0 0 1 32-32z';

/** An icon that takes the colour of the text around it. */
export function Icon({ name, className }: { name: IconName | 'hand'; className?: string }) {
  return (
    <svg
      className={className ? `catan-icon ${className}` : 'catan-icon'}
      viewBox={`0 0 ${GRID} ${GRID}`}
      aria-hidden="true"
    >
      <path d={name === 'hand' ? HAND_PATH : ICON_PATHS[name]} fill="currentColor" />
    </svg>
  );
}

/** The same outline as a shape inside the board's own SVG: `size` units across, centred on x, y. */
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
      transform={`translate(${x - size / 2} ${y - size / 2}) scale(${size / GRID})`}
      {...rest}
    />
  );
}
