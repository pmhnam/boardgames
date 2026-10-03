import type { GameStateMessage, MatchReplayDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import { playerName } from '../../games/types';
import { UnsupportedGame } from '../../games/UnsupportedGame';
import { api, errorMessage } from '../../shared/api/http';

const noop = () => undefined;

/** Steps through the states the server rebuilt from the seed and the action log. */
export function ReplayPage() {
  const { matchId = '' } = useParams();
  const [index, setIndex] = useState(0);

  const replay = useQuery({
    queryKey: ['replay', matchId],
    queryFn: () => api<MatchReplayDto>('GET', `/matches/${matchId}/replay`),
  });

  if (replay.isLoading) return <p className="muted">Loading replay…</p>;
  if (replay.isError || !replay.data) return <p className="error">{errorMessage(replay.error)}</p>;

  const { match, frames } = replay.data;
  const frame = frames[Math.min(index, frames.length - 1)];
  if (!frame) return <p className="muted">Nothing to replay.</p>;

  const GameComponent = getGameUi(match.gameType)?.component;
  const message: GameStateMessage = {
    gameId: match.id,
    gameType: match.gameType,
    version: frame.version,
    status: match.status,
    viewerPlayerId: null,
    state: frame.state,
  };
  const last = frames.length - 1;

  return (
    <div className="stack">
      <div className="card row">
        <button type="button" disabled={index === 0} onClick={() => setIndex(0)}>
          ⏮
        </button>
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Previous
        </button>
        <span>
          Move {frame.version} / {last}
          {frame.action &&
            ` · ${playerName(match.players, frame.action.playerId)}: ${frame.action.actionType}`}
        </span>
        <button type="button" disabled={index >= last} onClick={() => setIndex(index + 1)}>
          Next
        </button>
        <button type="button" disabled={index >= last} onClick={() => setIndex(last)}>
          ⏭
        </button>
      </div>
      {GameComponent ? (
        <GameComponent message={message} players={match.players} sendAction={noop} disabled />
      ) : (
        <UnsupportedGame gameType={match.gameType} />
      )}
    </div>
  );
}
