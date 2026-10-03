import type { ReactNode } from 'react';

/**
 * A card with the actions for it right underneath while it is selected. The popover follows
 * the card in the tab order, so picking a card and acting on it are two adjacent stops.
 */
export function CardSlot({
  card,
  open,
  alignEnd = false,
  children,
}: {
  card: ReactNode;
  open: boolean;
  /** Anchor the popover to the card's right edge, for cards near the right of the table. */
  alignEnd?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={open ? 'splendor-slot open' : 'splendor-slot'}>
      {card}
      {open && (
        <div className={alignEnd ? 'splendor-actions end' : 'splendor-actions'} role="group">
          {children}
        </div>
      )}
    </div>
  );
}
