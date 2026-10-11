import type { BangView } from '@bgp/game-bang';

/** Their turn, or a card played on them that they have to answer. */
export function awaitsBangViewer(view: BangView): boolean {
  return view.phase !== 'FINISHED' && (view.me?.legal.prompt ?? null) !== null;
}
