import type { MatchDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import { playerName } from '../../games/types';
import { UnsupportedGame } from '../../games/UnsupportedGame';
import { api, errorMessage } from '../../shared/api/http';
import { useMatchState } from './useMatchState';

export function MatchPage() {
  const { matchId = '' } = useParams();
  const { message, loadError, actionError, pending, sendAction } = useMatchState(matchId);
  const status = message?.status;

  // Refetched when the status flips so the result and room link are current.
  const match = useQuery({
    queryKey: ['match', matchId, status],
    queryFn: () => api<MatchDto>('GET', `/matches/${matchId}`),
  });

  if (loadError) return <p className="error">{loadError.message}</p>;
  if (match.isError) return <p className="error">{errorMessage(match.error)}</p>;
  if (!message || !match.data) return <p className="muted">Loading match…</p>;

  const definition = getGameUi(message.gameType);
  const GameComponent = definition?.component;
  const finished = message.status !== 'playing';
  const winners = match.data.result?.winnerPlayerIds ?? [];

  return (
    <div className="stack">
      {finished && (
        <div className="card result">
          <strong>
            {winners.length > 0
              ? `Winner: ${winners.map((id) => playerName(match.data.players, id)).join(' & ')}`
              : 'Match over'}
          </strong>
          <span className="row">
            <Link to={`/rooms/${match.data.roomId}`}>Back to room</Link>
            <Link to={`/matches/${matchId}/replay`}>Watch replay</Link>
          </span>
        </div>
      )}
      {message.viewerPlayerId === null && <p className="muted">You are watching this match.</p>}
      {actionError && <p className="error">{actionError.message}</p>}
      {GameComponent ? (
        <GameComponent
          message={message}
          players={match.data.players}
          sendAction={sendAction}
          disabled={pending || finished}
        />
      ) : (
        <UnsupportedGame gameType={message.gameType} />
      )}
    </div>
  );
}
