import type { AvalonView } from '@bgp/game-avalon';
import type { ReactNode } from 'react';
import type { SeatSpot } from '../../shared/seats';
import { useAvalonText } from '../useAvalonText';
import { PlayerSeat, type SeatProgress } from './PlayerSeat';

function progressOf(view: AvalonView, playerId: string): SeatProgress | null {
  if (view.phase === 'TEAM_VOTE') return view.voted.includes(playerId) ? 'voted' : 'voting';
  if (view.phase === 'QUEST' && view.team?.includes(playerId)) {
    return view.played.includes(playerId) ? 'played' : 'choosing';
  }
  return null;
}

/**
 * The round table: everyone in seat order with the viewer at the foot of it, and in the
 * middle what the table is doing. On a narrow screen the ring becomes a list in the same
 * order. Each seat is told only what concerns it, so a move draws the seats it touched.
 */
export function Table({
  view,
  me,
  nameOf,
  spots,
  selectable,
  selected,
  onToggle,
  children,
}: {
  view: AvalonView;
  me: string | null;
  nameOf(playerId: string): string;
  spots: SeatSpot[];
  /** The seats the viewer may choose right now. */
  selectable: readonly string[];
  selected: readonly string[];
  onToggle(playerId: string): void;
  /** What stands in the middle of the table. */
  children: ReactNode;
}) {
  const text = useAvalonText();
  // Votes are public only once everyone has voted: the last settled proposal shows them.
  const lastProposal = view.phase === 'TEAM_VOTE' ? undefined : view.proposals.at(-1);
  const ladyResults = view.lady?.inspections.filter((inspection) => inspection.holderId === me);

  return (
    <section className="avalon-table" aria-label={text.table}>
      <div className="avalon-ring" data-seats={view.seatOrder.length}>
        <div className="avalon-centre">{children}</div>
        <ul className="avalon-seats">
          {view.seatOrder.map((playerId, index) => (
            <PlayerSeat
              key={playerId}
              playerId={playerId}
              name={nameOf(playerId)}
              index={index}
              spot={spots[index] ?? { x: 50, y: 50 }}
              isYou={playerId === me}
              leader={view.leaderId === playerId}
              onTeam={view.team?.includes(playerId) ?? false}
              holdsLady={view.lady?.holderId === playerId}
              assassinated={view.assassinTargetId === playerId}
              winner={view.winnerPlayerIds.includes(playerId)}
              role={view.roles?.[playerId] ?? null}
              known={view.you?.knowledge.find((seen) => seen.playerId === playerId)?.as ?? null}
              shown={
                ladyResults?.find((inspection) => inspection.targetId === playerId)?.alignment ??
                null
              }
              progress={progressOf(view, playerId)}
              lastVote={lastProposal?.votes[playerId] ?? null}
              selectable={selectable.includes(playerId)}
              selected={selected.includes(playerId)}
              onToggle={onToggle}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
