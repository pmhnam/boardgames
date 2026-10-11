import type { AvalonView, Sighting, YouView } from '@bgp/game-avalon';
import { useState } from 'react';
import { useAvalonText } from '../useAvalonText';
import { Icon } from './Icon';

const SIGHTINGS: Sighting[] = ['EVIL', 'MERLIN_OR_MORGANA'];

/** The viewer's secret: their role and who it lets them see. It can be put face down. */
export function RoleCard({
  lady,
  you,
  me,
  nameOf,
}: {
  lady: AvalonView['lady'];
  you: YouView;
  me: string;
  nameOf(playerId: string): string;
}) {
  const text = useAvalonText();
  const [faceDown, setFaceDown] = useState(false);
  const side = you.alignment.toLowerCase();
  const shown = lady?.inspections.filter(
    (inspection) => inspection.holderId === me && inspection.alignment !== null,
  );

  return (
    <section className={`card avalon-role ${faceDown ? 'face-down' : side}`}>
      <h2 className="avalon-role-head">
        <span>{text.you.title}</span>
        <button type="button" className="link" onClick={() => setFaceDown(!faceDown)}>
          {faceDown ? text.you.show : text.you.hide}
        </button>
      </h2>
      {faceDown ? (
        <p className="muted">{text.you.faceDown}</p>
      ) : (
        <>
          <div className="avalon-identity">
            <span className={`avalon-crest ${side}`}>
              <Icon name={you.role} />
            </span>
            <div>
              <strong>{text.role[you.role]}</strong>
              <span className={`avalon-side-tag ${side}`}>
                <Icon name={you.alignment === 'GOOD' ? 'good' : 'evil'} />
                {text.alignment[you.alignment]}
              </span>
            </div>
          </div>
          <p className="muted">{text.roleBlurb[you.role]}</p>
          {SIGHTINGS.map((sighting) => {
            const seen = you.knowledge.filter((entry) => entry.as === sighting);
            return (
              seen.length > 0 && (
                <p key={sighting} className="avalon-sees">
                  <Icon name="seen" />
                  <span>
                    <strong>{text.sighting[sighting]}:</strong>{' '}
                    {seen.map((entry) => nameOf(entry.playerId)).join(', ')}
                  </span>
                </p>
              )
            );
          })}
          {shown?.map(
            (inspection) =>
              inspection.alignment && (
                <p key={inspection.targetId} className="avalon-sees">
                  <Icon name="lady" />
                  <span>
                    {text.you.ladyShowed(nameOf(inspection.targetId), inspection.alignment)}
                  </span>
                </p>
              ),
          )}
        </>
      )}
    </section>
  );
}
