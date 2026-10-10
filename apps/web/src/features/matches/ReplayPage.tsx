import type { GameStateMessage, MatchReplayDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import { playerName } from '../../games/types';
import { UnsupportedGame } from '../../games/UnsupportedGame';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';

const noop = () => undefined;

/** Steps through the states the server rebuilt from the seed and the action log. */
export function ReplayPage() {
  const t = useT();
  const { matchId = '' } = useParams();
  const [index, setIndex] = useState(0);

  const replay = useQuery({
    queryKey: ['replay', matchId],
    queryFn: () => api<MatchReplayDto>('GET', `/matches/${matchId}/replay`),
  });

  if (replay.isLoading) return <p className="muted">{t('replay.loading')}</p>;
  if (replay.isError || !replay.data) return <p className="error">{errorText(t, replay.error)}</p>;

  const { match, frames } = replay.data;
  const frame = frames[Math.min(index, frames.length - 1)];
  if (!frame) return <p className="muted">{t('replay.empty')}</p>;

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
        <button
          type="button"
          aria-label={t('replay.first')}
          disabled={index === 0}
          onClick={() => setIndex(0)}
        >
          ⏮
        </button>
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t('replay.previous')}
        </button>
        <span>
          {t('replay.move', { current: frame.version, total: last })}
          {frame.action &&
            ` · ${playerName(match.players, frame.action.playerId)}: ${frame.action.actionType}`}
        </span>
        <button type="button" disabled={index >= last} onClick={() => setIndex(index + 1)}>
          {t('replay.next')}
        </button>
        <button
          type="button"
          aria-label={t('replay.last')}
          disabled={index >= last}
          onClick={() => setIndex(last)}
        >
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
