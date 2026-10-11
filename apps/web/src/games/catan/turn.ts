import type { CatanView } from '@bgp/game-catan';

/** Their own turn, or someone else's that stops for them: cards owed to a 7, an offer to answer. */
export function awaitsCatanViewer(view: CatanView, viewerPlayerId: string): boolean {
  if (view.phase !== 'PLAYING') return false;
  const { legal, turn } = view;
  if (legal.mustDiscard > 0 || legal.canRespond) return true;
  // While hands are being discarded the turn's owner waits like everyone else.
  return turn.step !== 'DISCARD' && turn.activePlayerId === viewerPlayerId;
}
