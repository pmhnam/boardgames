import type { WerewolfView } from '@bgp/game-werewolf';

export function awaitsWerewolfViewer(view: WerewolfView): boolean {
  return view.phase !== 'FINISHED' && (view.me?.legal.action ?? null) !== null;
}
