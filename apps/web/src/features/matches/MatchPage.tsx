import type { MatchDto, PlayerAutoplayDto } from '@bgp/shared-types';
import { Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { gamesQuery } from '../../games/gamesQuery';
import { getGameUi } from '../../games/registry';
import { playerName } from '../../games/types';
import { UnsupportedGame } from '../../games/UnsupportedGame';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { useVoiceRoom } from '../../shared/voice/VoiceProvider';
import { useConnectionLost, useIsConnected } from '../../shared/websocket/SocketProvider';
import { ActionErrorToast } from './ActionErrorToast';
import { MatchSkeleton } from './MatchSkeleton';
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
  /** Known to have ended. Before the first message it is not known either way. */
  const over = message !== null && message.status !== 'playing';

  // Fetched again once the match ends, so the result and room link are current. Until that
  // answer comes the players already on screen stay there, and so does the board.
  const match = useQuery({
    queryKey: ['match', matchId, over],
    queryFn: () => api<MatchDto>('GET', `/matches/${matchId}`),
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === matchId ? previous : undefined,
  });

  // For the game's name. Shared with the lobby, so usually already loaded.
  const games = useQuery(gamesQuery);

  // A player is in the room the match belongs to, and so may be in its call.
  useVoiceRoom(message && message.viewerPlayerId !== null ? match.data?.roomId : null);

  // Whichever of the two answers names the game first starts its table loading.
  const gameType = message?.gameType ?? match.data?.gameType;
  useEffect(() => {
    if (gameType) getGameUi(gameType)?.preload?.();
  }, [gameType]);

  const definition = message ? getGameUi(message.gameType) : undefined;
  const finished = message?.status !== 'playing';
  const enabled =
    message?.autoplay?.some(
      (player) => player.playerId === message.viewerPlayerId && player.level !== null,
    ) ?? false;
  // A seat the computer is playing has nothing to call its owner back for.
  const awaited =
    message !== null &&
    message.viewerPlayerId !== null &&
    !finished &&
    !enabled &&
    definition?.awaitsViewer?.(message.state, message.viewerPlayerId) === true;
  const gameName = message
    ? (games.data?.find((game) => game.gameType === message.gameType)?.displayName ??
      message.gameType)
    : null;
  // First in the title, where a narrow tab still shows it.
  useDocumentTitle(
    awaited && gameName !== null ? `● ${t('match.yourTurn')} · ${gameName}` : gameName,
  );

  if (loadError) return <p className="error">{errorText(t, loadError)}</p>;
  if (match.isError) return <p className="error">{errorText(t, match.error)}</p>;
  if (!message || !match.data) return <MatchSkeleton label={t('match.loading')} />;

  const GameComponent = definition?.component;
  const winners = match.data.result?.winnerPlayerIds ?? [];
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
        <div className="game-area">
          {GameComponent ? (
            <Suspense fallback={<MatchSkeleton label={t('match.loading')} />}>
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
            </Suspense>
          ) : (
            <UnsupportedGame gameType={message.gameType} />
          )}
        </div>
      </div>
    </>
  );
}
