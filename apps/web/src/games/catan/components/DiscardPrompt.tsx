import { RESOURCES, type ResourceCounts } from '@bgp/game-catan';
import { useState } from 'react';
import { useCatanText } from '../useCatanText';
import { NO_RESOURCES, ResourcePicker, compact, totalOf } from './ResourcePicker';

/**
 * Picks the cards to give up to a 7. Several players may be discarding at once, and each
 * discard changes the match; the selection is kept through that.
 */
export function DiscardPrompt({
  hand,
  owed,
  disabled,
  onDiscard,
}: {
  hand: ResourceCounts;
  owed: number;
  disabled: boolean;
  onDiscard(resources: Partial<ResourceCounts>): void;
}) {
  const text = useCatanText();
  const [picked, setPicked] = useState<ResourceCounts>(NO_RESOURCES);
  // Never more than is held, whatever happened to the hand since.
  const chosen = Object.fromEntries(
    RESOURCES.map((resource) => [resource, Math.min(picked[resource], hand[resource])]),
  ) as ResourceCounts;
  const total = totalOf(chosen);

  return (
    <div className="catan-prompt-body">
      <ResourcePicker
        label={text.cardsToDiscard}
        value={chosen}
        onChange={setPicked}
        max={(resource) => (total >= owed ? chosen[resource] : hand[resource])}
        disabled={disabled}
      />
      <button
        type="button"
        disabled={disabled || total !== owed}
        onClick={() => onDiscard(compact(chosen))}
      >
        {text.discard(total, owed)}
      </button>
    </div>
  );
}
