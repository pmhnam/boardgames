import type { AvalonView } from '@bgp/game-avalon';

export function awaitsAvalonViewer({ legal }: AvalonView): boolean {
  return (
    legal.propose !== null ||
    legal.vote !== null ||
    legal.quest !== null ||
    legal.ladyTargets.length > 0 ||
    legal.assassinTargets.length > 0
  );
}
