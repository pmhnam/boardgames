import { RESOURCES, type ResourceCounts } from '@bgp/game-catan';
import { useEffect, useRef, useState } from 'react';

export interface HandChange {
  /** The state the change arrived with: new for every piece of news. */
  key: number;
  counts: ResourceCounts;
}

/** How many of each resource a hand gained (or, below zero, lost) between two states. */
export function handDifference(
  before: Readonly<ResourceCounts>,
  after: Readonly<ResourceCounts>,
): ResourceCounts {
  return Object.fromEntries(
    RESOURCES.map((resource) => [resource, after[resource] - before[resource]]),
  ) as ResourceCounts;
}

/**
 * What the viewer's hand gained and lost in the latest state, so a roll that pays out, a
 * trade or a robbery is seen on the cards themselves. Null while there is nothing to report.
 */
export function useHandChange(hand: Readonly<ResourceCounts>, version: number): HandChange | null {
  const last = useRef({ hand, version });
  const [change, setChange] = useState<HandChange | null>(null);

  useEffect(() => {
    const previous = last.current;
    last.current = { hand, version };
    if (previous.version === version) return;
    const counts = handDifference(previous.hand, hand);
    setChange(
      RESOURCES.some((resource) => counts[resource] !== 0) ? { key: version, counts } : null,
    );
  }, [version]);

  return change;
}
