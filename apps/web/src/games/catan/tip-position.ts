export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Space between a hint and what it explains. */
const GAP = 8;
/** How close to the edge of the window a hint may come. */
const MARGIN = 8;

/**
 * Where a hint goes, in window coordinates: centred above what it explains, below when there
 * is no room above, and pushed sideways as far as it takes to stay inside the window.
 */
export function placeTip(anchor: Box, bubble: Size, viewport: Size): { left: number; top: number } {
  const centred = anchor.left + anchor.width / 2 - bubble.width / 2;
  const furthestLeft = viewport.width - bubble.width - MARGIN;
  // A hint wider than the window starts at its left edge, so its first words can be read.
  const left = Math.max(MARGIN, Math.min(centred, furthestLeft));

  const above = anchor.top - GAP - bubble.height;
  const top = above >= MARGIN ? above : anchor.top + anchor.height + GAP;
  return { left, top };
}
