import type { Resource } from '@bgp/game-catan';
import { RESOURCE_FILL, RESOURCE_INK, RESOURCE_LABEL } from '../layout';

/** One shape per resource, so they can be told apart without relying on colour. */
const ICON_PATH: Record<Resource, string> = {
  brick: 'M2 5h9v4H2zM13 5h9v4h-9zM6 11h12v4H6zM2 17h9v3H2zM13 17h9v3h-9z',
  wood: 'M12 2l6 8h-3.5l5 7H4.5l5-7H6zM10.5 17h3v5h-3z',
  wool: 'M7 19a4.5 4.5 0 0 1-.7-8.95A5.5 5.5 0 0 1 17 9.2 5 5 0 0 1 17.5 19z',
  wheat:
    'M11 21h2V10h-2zM12 2c2 2 2 5 0 7c-2-2-2-5 0-7zM6 8c3 0 5 2 5 5c-3 0-5-2-5-5zM18 8c-3 0-5 2-5 5c3 0 5-2 5-5zM6 14c3 0 5 2 5 5c-3 0-5-2-5-5zM18 14c-3 0-5 2-5 5c3 0 5-2 5-5z',
  ore: 'M3 19l3.5-9L12 5l6.5 4L21 19zM9 19l3-7l4 7z',
};

export function ResourceIcon({ resource }: { resource: Resource }) {
  return (
    <svg className="catan-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICON_PATH[resource]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/** A resource with a count beside it. Without a count it is just the resource. */
export function ResourceChip({
  resource,
  count,
  dim,
}: {
  resource: Resource;
  count?: number;
  /** Shown faded: none held, or none asked for. */
  dim?: boolean;
}) {
  const label = count === undefined ? RESOURCE_LABEL[resource] : `${count} ${resource}`;
  return (
    <span
      className={dim ? 'catan-chip dim' : 'catan-chip'}
      style={{ background: RESOURCE_FILL[resource], color: RESOURCE_INK[resource] }}
      title={label}
    >
      <ResourceIcon resource={resource} />
      {count !== undefined && <span className="catan-chip-count">{count}</span>}
      <span className="sr-only">{label}</span>
    </span>
  );
}
