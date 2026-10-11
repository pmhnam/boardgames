import type { SplendorView } from '@bgp/game-splendor';

export function awaitsSplendorViewer(view: SplendorView, viewerPlayerId: string): boolean {
  return view.phase === 'PLAYING' && view.turn.activePlayerId === viewerPlayerId;
}
