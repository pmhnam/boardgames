import { GEM_COLORS, type GemCounts, type Noble } from '@bgp/game-splendor';
import type { ReactNode } from 'react';
import { GemToken } from './GemToken';

export function NobleTile({
  noble,
  bonuses,
  action,
}: {
  noble: Noble;
  /** The viewer's own bonuses: shows how far along they are. */
  bonuses?: GemCounts;
  action?: ReactNode;
}) {
  return (
    <div className="splendor-noble">
      <span className="splendor-noble-name">
        <strong>{noble.points}</strong> {noble.name}
      </span>
      <span className="splendor-noble-needs">
        <span className="sr-only">needs bonuses: </span>
        {GEM_COLORS.filter((color) => noble.requirement[color] > 0).map((color) => {
          const need = noble.requirement[color];
          const have = bonuses ? Math.min(bonuses[color], need) : null;
          return (
            <span key={color} className={have === need ? 'splendor-need met' : 'splendor-need'}>
              <GemToken color={color} count={need} bonus small />
              {have !== null && (
                <small>
                  {have === need ? '✓' : `${have}/${need}`}
                  <span className="sr-only"> held</span>
                </small>
              )}
            </span>
          );
        })}
      </span>
      {action}
    </div>
  );
}
