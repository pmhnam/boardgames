import type { MatchDto, PlayerAutoplayDto } from '@bgp/shared-types';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import { playerName } from '../../games/types';
import { UnsupportedGame } from '../../games/UnsupportedGame';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { useConnectionLost, useIsConnected } from '../../shared/websocket/SocketProvider';
import { ActionErrorToast } from './ActionErrorToast';
import { useMatchState } from './useMatchState';
import './match.css';

export function MatchPage() {
  const t = useT();
  const { matchId = '' } = useParams();
  const { message, loadError, actionError, pending, sendAction, acceptControl } =
    useMatchState(matchId);
  const [controlRequest, setControlRequest] = useState<{
    gameId: string;
    pending: boolean;
    error: string | null;
  } | null>(null);
  const connected = useIsConnected();
  const connectionLost = useConnectionLost();
  const status = message?.status;

  // Refetched when the status flips so the result and room link are current.
  const match = useQuery({
    queryKey: ['match', matchId, status],
    queryFn: () => api<MatchDto>('GET', `/matches/${matchId}`),
  });

  if (loadError) return <p className="error">{errorText(t, loadError)}</p>;
  if (match.isError) return <p className="error">{errorText(t, match.error)}</p>;
  if (!message || !match.data) return <p className="muted">{t('match.loading')}</p>;

  const definition = getGameUi(message.gameType);
  const GameComponent = definition?.component;
  const finished = message.status !== 'playing';
  const winners = match.data.result?.winnerPlayerIds ?? [];
  const enabled =
    message.autoplay?.some(
      (player) => player.playerId === message.viewerPlayerId && player.level !== null,
    ) ?? false;
  const controlPending = controlRequest?.gameId === matchId && controlRequest.pending;
  const autoplay =
    definition?.supportsAutoplay && message.viewerPlayerId !== null && !finished
      ? {
          enabled,
          pending: Boolean(controlPending),
          error: controlRequest?.gameId === matchId ? controlRequest.error : null,
          toggle: () => {
            if (controlPending || pending) return;
            setControlRequest({ gameId: matchId, pending: true, error: null });
            void api<PlayerAutoplayDto>('PUT', `/matches/${matchId}/autoplay`, {
              enabled: !enabled,
            })
              .then((player) => {
                acceptControl({ gameId: matchId, players: [player] });
                setControlRequest((current) =>
                  current?.gameId === matchId
                    ? { gameId: matchId, pending: false, error: null }
                    : current,
                );
              })
              .catch((error: unknown) =>
                setControlRequest((current) =>
                  current?.gameId === matchId
                    ? { gameId: matchId, pending: false, error: errorText(t, error) }
                    : current,
                ),
              );
          },
        }
      : undefined;

  return (
    <>
      <ActionErrorToast error={actionError} />
      <div className={connectionLost ? 'stack match-page offline' : 'stack match-page'}>
        {finished && (
          <div className="card result">
            <strong>
              {message.status === 'abandoned'
                ? t('match.abandoned')
                : winners.length > 0
                  ? t('history.wonBy', {
                      names: winners.map((id) => playerName(match.data.players, id)).join(' & '),
                    })
                  : t('match.over')}
            </strong>
            <span className="row">
              <Link to={`/rooms/${match.data.roomId}`}>{t('match.backToRoom')}</Link>
              <Link to={`/matches/${matchId}/replay`}>{t('history.replay')}</Link>
            </span>
          </div>
        )}
        {message.viewerPlayerId === null && <p className="muted">{t('match.watching')}</p>}
        {GameComponent ? (
          <GameComponent
            key={matchId}
            message={message}
            players={match.data.players}
            sendAction={sendAction}
            disabled={
              pending ||
              finished ||
              enabled ||
              Boolean(controlPending) ||
              !connected ||
              connectionLost
            }
            autoplay={autoplay}
          />
        ) : (
          <UnsupportedGame gameType={message.gameType} />
        )}
      </div>
    </>
  );
}
