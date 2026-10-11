import { alignmentOf, type Alignment, type Role, type Sighting } from '@bgp/game-avalon';
import { memo, type CSSProperties } from 'react';
import type { SeatSpot } from '../../shared/seats';
import { useAvalonText } from '../useAvalonText';
import { Icon } from './Icon';

/** What a seat is doing in a phase where several people act at once. */
export type SeatProgress = 'voting' | 'voted' | 'choosing' | 'played';

export interface SeatProps {
  playerId: string;
  name: string;
  /** The seat's place in the order: its colour. */
  index: number;
  spot: SeatSpot;
  isYou: boolean;
  leader: boolean;
  onTeam: boolean;
  holdsLady: boolean;
  assassinated: boolean;
  winner: boolean;
  /** Shown to everyone once the game is over. */
  role: Role | null;
  /** What the viewer's own role lets them see of this player. */
  known: Sighting | null;
  /** What the Lady of the Lake showed the viewer about this player. */
  shown: Alignment | null;
  progress: SeatProgress | null;
  /** Their vote on the last team settled, once votes are public. */
  lastVote: boolean | null;
  selectable: boolean;
  selected: boolean;
  onToggle(playerId: string): void;
}

/**
 * One player at the round table. It is a button while the viewer may choose this player, and
 * is drawn again only when something about this seat changed: every prop is a plain value.
 */
export const PlayerSeat = memo(function PlayerSeat(props: SeatProps) {
  const text = useAvalonText();
  const { name, role, known, shown, progress, lastVote } = props;
  const side = role ? alignmentOf(role).toLowerCase() : '';
  const progressText =
    progress === null
      ? null
      : {
          voting: text.seat.voting,
          voted: text.seat.voted,
          choosing: text.seat.choosing,
          played: text.seat.played,
        }[progress];
  const waiting = progress === 'voting' || progress === 'choosing';
  const statusText = progressText ?? (lastVote === null ? null : text.seat.lastVote(lastVote));

  const body = (
    <>
      <span className="avalon-seat-head">
        <span className="avalon-face" aria-hidden="true">
          <span className="avalon-avatar">
            {role ? <Icon name={role} /> : name.slice(0, 1).toUpperCase()}
          </span>
          {/* How they voted on the team last settled stays while that team is on its quest. */}
          {lastVote !== null && !role && (
            <span className={lastVote ? 'avalon-ballot yes' : 'avalon-ballot no'}>
              <Icon name={lastVote ? 'approve' : 'reject'} />
            </span>
          )}
          {progress === 'voted' && (
            <span className="avalon-ballot done">
              <Icon name="check" />
            </span>
          )}
        </span>
        <span className="avalon-seat-names">
          <span className="avalon-seat-name">
            {name}
            {props.isYou && <span className="avalon-you"> ({text.seat.you})</span>}
          </span>
          {role ? (
            <span className={`avalon-reveal ${side}`}>{text.role[role]}</span>
          ) : (
            statusText !== null && (
              <span
                className={`avalon-seat-status${waiting ? ' waiting' : progress ? ' done' : ''}`}
              >
                {statusText}
              </span>
            )
          )}
        </span>
      </span>
      {(known || shown) && !role && (
        <span className="avalon-knowledge">
          {known && (
            <span className={known === 'EVIL' ? 'avalon-known evil' : 'avalon-known'}>
              <Icon name="seen" />
              {text.sighting[known]}
            </span>
          )}
          {shown && (
            <span className={`avalon-known ${shown.toLowerCase()}`}>
              <Icon name="lady" />
              {text.seat.ladyShowed(shown)}
            </span>
          )}
        </span>
      )}
    </>
  );

  const marks = [
    props.winner && { key: 'winner', icon: 'trophy' as const, label: text.seat.winner },
    props.leader && { key: 'leader', icon: 'leader' as const, label: text.seat.leader },
    props.onTeam && { key: 'team', icon: 'team' as const, label: text.seat.onTeam },
    props.holdsLady && { key: 'lady', icon: 'lady' as const, label: text.seat.lady },
    props.assassinated && { key: 'dagger', icon: 'dagger' as const, label: text.seat.assassinated },
  ].filter((mark) => mark !== false);

  const className = [
    'avalon-seat',
    props.isYou && 'mine',
    props.leader && 'leader',
    props.onTeam && 'on-team',
    props.selectable && 'selectable',
    props.selected && 'selected',
    side,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li
      className={className}
      style={
        {
          '--x': `${props.spot.x}%`,
          '--y': `${props.spot.y}%`,
          '--seat-hue': `${(props.index * 47) % 360}`,
        } as CSSProperties
      }
    >
      {marks.length > 0 && (
        <span className="avalon-marks">
          {marks.map((mark) => (
            <span key={mark.key} className={`avalon-mark ${mark.key}`} title={mark.label}>
              <Icon name={mark.icon} />
              <span className="sr-only">{mark.label}</span>
            </span>
          ))}
        </span>
      )}
      {props.selectable ? (
        <button
          type="button"
          className="avalon-seat-body"
          aria-pressed={props.selected}
          onClick={() => props.onToggle(props.playerId)}
        >
          {body}
        </button>
      ) : (
        <div className="avalon-seat-body">{body}</div>
      )}
    </li>
  );
});
