import type { MatchDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { playerName } from '../../games/types';
import { api, errorMessage } from '../../shared/api/http';
import { useAuthStore } from '../auth/auth.store';

export function MatchHistoryPage() {
  const userId = useAuthStore((state) => state.session?.user.id);
  const matches = useQuery({
    queryKey: ['matches', userId],
    queryFn: () => api<MatchDto[]>('GET', `/users/${userId}/matches`),
    enabled: userId !== undefined,
  });

  if (matches.isLoading) return <p className="muted">Loading…</p>;
  if (matches.isError) return <p className="error">{errorMessage(matches.error)}</p>;

  return (
    <div className="card">
      <h1>My matches</h1>
      {matches.data?.length === 0 && <p className="muted">No matches yet.</p>}
      <table>
        <tbody>
          {matches.data?.map((match) => (
            <tr key={match.id}>
              <td>{new Date(match.createdAt).toLocaleString()}</td>
              <td>{match.gameType}</td>
              <td>{match.players.map((player) => player.displayName).join(' vs ')}</td>
              <td>
                {match.status === 'finished'
                  ? `Won by ${(match.result?.winnerPlayerIds ?? [])
                      .map((id) => playerName(match.players, id))
                      .join(' & ')}`
                  : match.status}
              </td>
              <td>
                {match.status === 'playing' ? (
                  <Link to={`/matches/${match.id}`}>Resume</Link>
                ) : (
                  <Link to={`/matches/${match.id}/replay`}>Replay</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
