import { RESOURCES, type ResourceCounts } from '@bgp/game-catan';
import { useRef } from 'react';

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
  // Worked out while the new state is drawn, not after it: the news is on the cards in the
  // same frame as the hand it is about.
  const last = useRef<{
    hand: Readonly<ResourceCounts>;
    version: number;
    change: HandChange | null;
  }>({ hand, version, change: null });
  if (last.current.version !== version) {
    const counts = handDifference(last.current.hand, hand);
    const changed = RESOURCES.some((resource) => counts[resource] !== 0);
    last.current = { hand, version, change: changed ? { key: version, counts } : null };
  }
  return last.current.change;
}
