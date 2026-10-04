import { alignmentOf, type AvalonView } from '@bgp/game-avalon';
import type { MatchPlayerDto } from '@bgp/shared-types';
import { playerName } from '../../types';
import { ROLE_LABEL, SIGHTING_LABEL } from '../layout';

/** What a seat is doing in a phase where several people act at once. */
function describeProgress(view: AvalonView, playerId: string): string | null {
  if (view.phase === 'TEAM_VOTE') return view.voted.includes(playerId) ? 'Voted' : 'Voting…';
  if (view.phase === 'QUEST' && view.team?.includes(playerId)) {
    return view.played.includes(playerId) ? 'Card played' : 'Choosing…';
  }
  return null;
}

/**
 * Everyone at the table, in seat order. While the viewer has someone to choose, the seats they
 * may choose are buttons.
 */
export function PlayerSeats({
  view,
  players,
  me,
  selectable,
  selected,
  onToggle,
}: {
  view: AvalonView;
  players: MatchPlayerDto[];
  me: string | null;
  selectable: string[];
  selected: string[];
  onToggle(playerId: string): void;
}) {
  const lastProposal = view.phase === 'TEAM_VOTE' ? undefined : view.proposals.at(-1);
  const ladyResults = view.lady?.inspections.filter((inspection) => inspection.holderId === me);

  return (
    <ul className="avalon-seats">
      {view.seatOrder.map((playerId) => {
        const role = view.roles?.[playerId];
        const known = view.you?.knowledge.find((seen) => seen.playerId === playerId);
        const shown = ladyResults?.find((inspection) => inspection.targetId === playerId);
        const progress = describeProgress(view, playerId);
        const lastVote = lastProposal?.votes[playerId];
        const classes = [
          'avalon-seat',
          playerId === me && 'mine',
          view.team?.includes(playerId) && 'on-team',
          selected.includes(playerId) && 'selected',
          role && alignmentOf(role).toLowerCase(),
        ]
          .filter(Boolean)
          .join(' ');

        const body = (
          <>
            <span className="avalon-seat-name">
              {playerName(players, playerId)}
              {playerId === me && <span className="muted"> (you)</span>}
              {view.winnerPlayerIds.includes(playerId) && ' 🏆'}
            </span>
            <span className="avalon-tags">
              {view.leaderId === playerId && <span className="avalon-tag leader">Leader</span>}
              {view.team?.includes(playerId) && <span className="avalon-tag team">On team</span>}
              {view.lady?.holderId === playerId && <span className="avalon-tag">Lady</span>}
              {view.assassinTargetId === playerId && (
                <span className="avalon-tag evil">Assassinated</span>
              )}
            </span>
            {role ? (
              <span className={`avalon-reveal ${alignmentOf(role).toLowerCase()}`}>
                {ROLE_LABEL[role]}
              </span>
            ) : (
              <>
                {known && (
                  <span className={`avalon-known ${known.as === 'EVIL' ? 'evil' : ''}`}>
                    {SIGHTING_LABEL[known.as]}
                  </span>
                )}
                {shown?.alignment && (
                  <span className={`avalon-known ${shown.alignment.toLowerCase()}`}>
                    The Lady showed: {shown.alignment === 'GOOD' ? 'Good' : 'Evil'}
                  </span>
                )}
              </>
            )}
            <span className="avalon-seat-status muted">
              {progress ??
                (lastVote === undefined ? ' ' : `Last vote: ${lastVote ? 'approved' : 'rejected'}`)}
            </span>
          </>
        );

        return (
          <li key={playerId} className={classes}>
            {selectable.includes(playerId) ? (
              <button
                type="button"
                className="avalon-seat-body"
                aria-pressed={selected.includes(playerId)}
                onClick={() => onToggle(playerId)}
              >
                {body}
              </button>
            ) : (
              <div className="avalon-seat-body">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
