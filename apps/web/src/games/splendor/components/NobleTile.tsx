import { GEM_COLORS, type GemCounts, type Noble } from '@bgp/game-splendor';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { nobleImageUrl } from '../card-images';
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
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = nobleImageUrl(noble);
  const artwork = imageUrl && !imageFailed;
  return (
    <div className="splendor-noble">
      {artwork ? (
        <img
          className="splendor-noble-image"
          src={imageUrl}
          alt={`${noble.name}, ${noble.points} points; needs ${GEM_COLORS.filter(
            (color) => noble.requirement[color] > 0,
          )
            .map((color) => `${noble.requirement[color]} ${color}`)
            .join(', ')} bonuses`}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <>
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
        </>
      )}
      {action}
    </div>
  );
}
