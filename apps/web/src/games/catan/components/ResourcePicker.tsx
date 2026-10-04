import { RESOURCES, type Resource, type ResourceCounts } from '@bgp/game-catan';
import { RESOURCE_LABEL } from '../layout';
import { ResourceChip } from './ResourceChip';

export const NO_RESOURCES: ResourceCounts = { brick: 0, wood: 0, wool: 0, grain: 0, ore: 0 };

export function totalOf(counts: Readonly<ResourceCounts>): number {
  return RESOURCES.reduce((sum, resource) => sum + counts[resource], 0);
}

/** Only the resources with a count, as an action carries them. */
export function compact(counts: Readonly<ResourceCounts>): Partial<ResourceCounts> {
  return Object.fromEntries(RESOURCES.flatMap((r) => (counts[r] > 0 ? [[r, counts[r]]] : [])));
}

/** A count for each resource, set with − and + buttons. */
export function ResourcePicker({
  label,
  value,
  onChange,
  max,
  disabled,
}: {
  label: string;
  value: ResourceCounts;
  onChange(value: ResourceCounts): void;
  /** The most of a resource that may be picked. No limit when left out. */
  max?(resource: Resource): number;
  disabled?: boolean;
}) {
  const step = (resource: Resource, by: number) =>
    onChange({ ...value, [resource]: value[resource] + by });

  return (
    <div className="catan-picker" role="group" aria-label={label}>
      {RESOURCES.map((resource) => {
        const limit = max ? max(resource) : Infinity;
        return (
          <span key={resource} className="catan-stepper">
            <button
              type="button"
              className="secondary"
              disabled={disabled || value[resource] === 0}
              aria-label={`One ${RESOURCE_LABEL[resource].toLowerCase()} fewer`}
              onClick={() => step(resource, -1)}
            >
              −
            </button>
            <ResourceChip resource={resource} count={value[resource]} dim={value[resource] === 0} />
            <button
              type="button"
              className="secondary"
              disabled={disabled || value[resource] >= limit}
              aria-label={`One ${RESOURCE_LABEL[resource].toLowerCase()} more`}
              onClick={() => step(resource, 1)}
            >
              +
            </button>
          </span>
        );
      })}
    </div>
  );
}

/** A line of chips for the resources with a count, e.g. one side of a trade. */
export function ResourceList({ counts }: { counts: Readonly<Partial<ResourceCounts>> }) {
  const held = RESOURCES.filter((resource) => (counts[resource] ?? 0) > 0);
  if (held.length === 0) return <span className="muted">nothing</span>;
  return (
    <span className="catan-chips">
      {held.map((resource) => (
        <ResourceChip key={resource} resource={resource} count={counts[resource]} />
      ))}
    </span>
  );
}
