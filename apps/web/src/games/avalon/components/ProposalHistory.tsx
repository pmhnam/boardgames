import type { AvalonView } from '@bgp/game-avalon';
import type { MatchPlayerDto } from '@bgp/shared-types';
import { playerName } from '../../types';

/** Every settled proposal: who led, who was picked and how each player voted. */
export function ProposalHistory({
  view,
  players,
}: {
  view: AvalonView;
  players: MatchPlayerDto[];
}) {
  if (view.proposals.length === 0) return null;
  return (
    <section className="card">
      <h2>Votes so far</h2>
      <table className="avalon-history">
        <thead>
          <tr>
            <th scope="col">Quest</th>
            <th scope="col">Leader</th>
            {view.seatOrder.map((playerId) => (
              <th key={playerId} scope="col">
                {playerName(players, playerId)}
              </th>
            ))}
            <th scope="col">Team</th>
          </tr>
        </thead>
        <tbody>
          {view.proposals.map((proposal, index) => (
            <tr key={index}>
              <td className="num">{proposal.quest + 1}</td>
              <td>{playerName(players, proposal.leaderId)}</td>
              {view.seatOrder.map((playerId) => (
                <td
                  key={playerId}
                  className={
                    proposal.team.includes(playerId) ? 'avalon-vote picked' : 'avalon-vote'
                  }
                >
                  <span className={proposal.votes[playerId] ? 'yes' : 'no'} aria-hidden="true">
                    {proposal.votes[playerId] ? '✓' : '✗'}
                  </span>
                  <span className="sr-only">
                    {proposal.votes[playerId] ? 'approved' : 'rejected'}
                    {proposal.team.includes(playerId) ? ', on the team' : ''}
                  </span>
                </td>
              ))}
              <td>{proposal.approved ? 'Sent' : 'Rejected'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted avalon-legend">A shaded cell marks a player picked for that team.</p>
    </section>
  );
}
