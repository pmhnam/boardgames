import { ICON_PATHS, type IconName } from '../art/icons';

/** The grid the outlines are drawn on. */
const GRID = 512;

/** An icon that takes the colour of the text around it. */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `avalon-icon ${className}` : 'avalon-icon'}
      viewBox={`0 0 ${GRID} ${GRID}`}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} fill="currentColor" />
    </svg>
  );
}
