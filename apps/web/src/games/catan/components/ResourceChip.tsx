import type { Resource } from '@bgp/game-catan';
import type { CSSProperties } from 'react';
import { useHints } from '../hints';
import { RESOURCE_FILL, RESOURCE_INK } from '../layout';
import { useCatanText } from '../useCatanText';
import { Icon } from './Icon';
import { HintText, Tip } from './Tip';

/** The resource's own colour, for the stylesheet to paint with. */
export function resourceStyle(resource: Resource): CSSProperties {
  return {
    '--resource': RESOURCE_FILL[resource],
    '--ink': RESOURCE_INK[resource],
  } as CSSProperties;
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
  const text = useCatanText();
  const hints = useHints();
  const label = count === undefined ? text.resource[resource] : text.amount(count, resource);
  return (
    <Tip hint={<HintText hint={hints.resource(resource)} />}>
      <span className={dim ? 'catan-chip dim' : 'catan-chip'} style={resourceStyle(resource)}>
        <Icon name={resource} />
        {count !== undefined && <span className="catan-chip-count">{count}</span>}
        <span className="sr-only">{label}</span>
      </span>
    </Tip>
  );
}

/**
 * A resource as a card in the viewer's hand: its picture over how many are held. A change in
 * the count since the last state floats past it.
 */
export function ResourceCard({
  resource,
  count,
  change = 0,
  changeKey,
}: {
  resource: Resource;
  count: number;
  change?: number;
  /** Changes whenever `change` is news, so the same gain twice in a row still shows twice. */
  changeKey?: number;
}) {
  const label = useCatanText().amount(count, resource);
  const hints = useHints();
  return (
    <Tip hint={<HintText hint={hints.resource(resource)} />}>
      <span
        className={count === 0 ? 'catan-card-tile empty' : 'catan-card-tile'}
        style={resourceStyle(resource)}
      >
        <Icon name={resource} />
        <span className="catan-card-count" aria-hidden="true">
          {count}
        </span>
        <span className="sr-only">{label}</span>
        {change !== 0 && (
          <span key={changeKey} className={change > 0 ? 'catan-change gain' : 'catan-change loss'}>
            {change > 0 ? `+${change}` : `−${-change}`}
          </span>
        )}
      </span>
    </Tip>
  );
}
