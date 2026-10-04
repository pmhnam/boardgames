import type { AvalonView, Sighting, YouView } from '@bgp/game-avalon';
import type { MatchPlayerDto } from '@bgp/shared-types';
import { useState } from 'react';
import { playerName } from '../../types';
import { ALIGNMENT_LABEL, ROLE_BLURB, ROLE_LABEL, SIGHTING_LABEL } from '../layout';

const SIGHTINGS: Sighting[] = ['EVIL', 'MERLIN_OR_MORGANA'];

/** The viewer's secret: their role and who it lets them see. It can be put face down. */
export function RoleCard({
  view,
  you,
  me,
  players,
}: {
  view: AvalonView;
  you: YouView;
  me: string;
  players: MatchPlayerDto[];
}) {
  const [faceDown, setFaceDown] = useState(false);
  const side = you.alignment.toLowerCase();
  const shown = view.lady?.inspections.filter(
    (inspection) => inspection.holderId === me && inspection.alignment !== null,
  );

  return (
    <section className={`card avalon-role ${faceDown ? '' : side}`}>
      <h2 className="avalon-role-head">
        <span>Your role</span>
        <button type="button" className="link" onClick={() => setFaceDown(!faceDown)}>
          {faceDown ? 'Show' : 'Hide'}
        </button>
      </h2>
      {faceDown ? (
        <p className="muted">Face down. Nobody else can see it either way.</p>
      ) : (
        <>
          <p className="avalon-role-name">
            {ROLE_LABEL[you.role]}
            <span className={`avalon-tag ${side}`}>{ALIGNMENT_LABEL[you.alignment]}</span>
          </p>
          <p className="muted">{ROLE_BLURB[you.role]}</p>
          {SIGHTINGS.map((sighting) => {
            const seen = you.knowledge.filter((entry) => entry.as === sighting);
            return (
              seen.length > 0 && (
                <p key={sighting}>
                  <strong>{SIGHTING_LABEL[sighting]}:</strong>{' '}
                  {seen.map((entry) => playerName(players, entry.playerId)).join(', ')}
                </p>
              )
            );
          })}
          {shown?.map((inspection) => (
            <p key={inspection.targetId}>
              <strong>The Lady showed you:</strong> {playerName(players, inspection.targetId)} is{' '}
              {inspection.alignment === 'GOOD' ? 'good' : 'evil'}.
            </p>
          ))}
        </>
      )}
    </section>
  );
}
