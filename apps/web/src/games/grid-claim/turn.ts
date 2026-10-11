import type { GridClaimView } from '@bgp/game-demo';

export function awaitsGridClaimViewer(view: GridClaimView, viewerPlayerId: string): boolean {
  return view.phase === 'PLAYING' && view.turn.activePlayerId === viewerPlayerId;
}
