import type { HarmoniesView } from '@bgp/game-harmonies';

export function awaitsHarmoniesViewer(view: HarmoniesView, viewerPlayerId: string): boolean {
  return view.phase === 'PLAYING' && view.turn.activePlayerId === viewerPlayerId;
}
