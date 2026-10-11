import type { AvalonView } from '@bgp/game-avalon';
import { memo } from 'react';
import { useAvalonText } from '../useAvalonText';
import { Icon } from './Icon';

/**
 * Every settled proposal: who led, who was picked and how each player voted. It gains a row
 * when a vote is settled and is otherwise left alone.
 */
export const ProposalHistory = memo(function ProposalHistory({
  proposals,
  seatOrder,
  nameOf,
}: {
  proposals: AvalonView['proposals'];
  seatOrder: AvalonView['seatOrder'];
  nameOf(playerId: string): string;
}) {
  const text = useAvalonText();
  if (proposals.length === 0) return null;
  return (
    <section className="card avalon-record">
      <h2>
        <Icon name="scroll" /> {text.history.title}
      </h2>
      <div className="avalon-history-scroll">
        <table className="avalon-history">
          <thead>
            <tr>
              <th scope="col">{text.history.quest}</th>
              <th scope="col">{text.history.leader}</th>
              {seatOrder.map((playerId) => (
                <th key={playerId} scope="col" className="avalon-history-name">
                  {nameOf(playerId)}
                </th>
              ))}
              <th scope="col">{text.history.result}</th>
            </tr>
          </thead>
          <tbody>
            {proposals.map((proposal, index) => (
              <tr key={index} className={proposal.approved ? 'sent' : 'turned-down'}>
                <td className="num">{proposal.quest + 1}</td>
                <td>{nameOf(proposal.leaderId)}</td>
                {seatOrder.map((playerId) => {
                  const approved = proposal.votes[playerId] === true;
                  const picked = proposal.team.includes(playerId);
                  return (
                    <td key={playerId} className={picked ? 'avalon-vote picked' : 'avalon-vote'}>
                      <span className={approved ? 'yes' : 'no'} aria-hidden="true">
                        <Icon name={approved ? 'approve' : 'reject'} />
                      </span>
                      <span className="sr-only">
                        {approved ? text.history.approved : text.history.rejectedVote}
                        {picked ? `, ${text.history.onTeam}` : ''}
                      </span>
                    </td>
                  );
                })}
                <td>{proposal.approved ? text.history.sent : text.history.rejected}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted hint">{text.history.legend}</p>
    </section>
  );
});
