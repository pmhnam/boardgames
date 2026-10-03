import { GEM_COLORS, type Noble } from '@bgp/game-splendor';
import type { ReactNode } from 'react';
import { GemToken } from './GemToken';

export function NobleTile({ noble, action }: { noble: Noble; action?: ReactNode }) {
  return (
    <div className="splendor-noble">
      <span className="splendor-noble-name">
        <strong>{noble.points}</strong> {noble.name}
      </span>
      <span className="splendor-noble-needs">
        <span className="sr-only">needs bonuses: </span>
        {GEM_COLORS.filter((color) => noble.requirement[color] > 0).map((color) => (
          <GemToken key={color} color={color} count={noble.requirement[color]} bonus small />
        ))}
      </span>
      {action}
    </div>
  );
}
