import {
  type AddBotRequest,
  type UpdateRoomSettingsRequest,
  type BotLevel,
  ClientEvents,
  ServerEvents,
  type GameStartedMessage,
  type RoomDto,
  type RoomMemberDto,
  type SetReadyRequest,
  type StartRoomResponse,
} from '@bgp/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { gamesQuery } from '../../games/gamesQuery';
import { getGameUi } from '../../games/registry';
import { useGameConfig } from '../../games/useGameConfig';
import { api } from '../../shared/api/http';
import { Avatar } from '../../shared/components/Avatar';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { errorText } from '../../shared/i18n/errors';
import { useLocale, useT } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';
import { useDocumentTitle } from '../../shared/useDocumentTitle';
import { useVoiceRoom } from '../../shared/voice/VoiceProvider';
import { useSocket } from '../../shared/websocket/SocketProvider';
import { useAuthStore } from '../auth/auth.store';
import { GameIcon } from '../lobby/GameIcon';
import '../lobby/lobby.css';
import { emptySeats, primaryAction, startBlocker } from './room-actions';
import './room.css';

const BOT_LEVELS: BotLevel[] = ['easy', 'normal', 'hard'];
const BOT_LEVEL_KEYS: Record<BotLevel, MessageKey> = {
  easy: 'botLevel.easy',
  normal: 'botLevel.normal',
  hard: 'botLevel.hard',
};

/** How long the copy button says it worked. */
const COPIED_FOR_MS = 2000;

const PLACEHOLDER_SEATS = [0, 1, 2];

function RoomSkeleton({ label }: { label: string }) {
  return (
    <div className="room" aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      <div className="room-header" aria-hidden="true">
        <span className="game-icon large skeleton" />
        <div className="room-header-text">
          <span className="skeleton skeleton-line room-skeleton-title" />
          <span className="skeleton skeleton-line short" />
        </div>
      </div>
      <div className="room-layout" aria-hidden="true">
        <div className="room-main">
          <div className="room-panel">
            <ul className="seat-grid">
              {PLACEHOLDER_SEATS.map((seat) => (
                <li key={seat} className="seat skeleton" />
              ))}
            </ul>
          </div>
        </div>
        <div className="room-side">
          <span className="skeleton room-skeleton-invite" />
        </div>
      </div>
    </div>
  );
}

export function RoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();
  const locale = useLocale();
  const t = useT();
  const userId = useAuthStore((state) => state.session?.user.id);
  const queryKey = ['room', roomId];

  const room = useQuery({ queryKey, queryFn: () => api<RoomDto>('GET', `/rooms/${roomId}`) });

  // Live updates. Subscribing again on every `connect` is what makes reconnects work.
  useEffect(() => {
    if (!socket) return;
    const subscribe = () => {
      void socket.emitWithAck(ClientEvents.RoomJoin, { roomId }).then((ack) => {
        if (ack.ok) queryClient.setQueryData(['room', roomId], ack.data);
      });
    };
    const onUpdated = (updated: RoomDto) => {
      if (updated.id !== roomId) return;
      queryClient.setQueryData(['room', roomId], updated);
      if (!updated.members.some((member) => member.userId === userId)) navigate('/');
    };
    const onStarted = (message: GameStartedMessage) => {
      if (message.roomId === roomId) navigate(`/matches/${message.matchId}`);
    };

    socket.on('connect', subscribe);
    socket.on(ServerEvents.RoomUpdated, onUpdated);
    socket.on(ServerEvents.GameStarted, onStarted);
    if (socket.connected) subscribe();

    return () => {
      socket.off('connect', subscribe);
      socket.off(ServerEvents.RoomUpdated, onUpdated);
      socket.off(ServerEvents.GameStarted, onStarted);
      socket.emit(ClientEvents.RoomLeave, { roomId });
    };
  }, [socket, roomId, queryClient, navigate, userId]);

  const update = (data: RoomDto) => queryClient.setQueryData(queryKey, data);
  const setReady = useMutation({
    mutationFn: (body: SetReadyRequest) => api<RoomDto>('POST', `/rooms/${roomId}/ready`, body),
    onSuccess: update,
  });
  const start = useMutation({
    mutationFn: () => api<StartRoomResponse>('POST', `/rooms/${roomId}/start`),
    onSuccess: ({ matchId }) => navigate(`/matches/${matchId}`),
  });
  const leave = useMutation({
    mutationFn: () => api<RoomDto>('POST', `/rooms/${roomId}/leave`),
    onSuccess: () => navigate('/'),
  });
  const join = useMutation({
    mutationFn: () => api<RoomDto>('POST', `/rooms/${roomId}/join`),
    onSuccess: update,
  });
  const addBot = useMutation({
    mutationFn: (body: AddBotRequest) => api<RoomDto>('POST', `/rooms/${roomId}/bots`, body),
    onSuccess: update,
  });
  const removeBot = useMutation({
    mutationFn: (botUserId: string) => api<RoomDto>('DELETE', `/rooms/${roomId}/bots/${botUserId}`),
    onSuccess: update,
  });
  const kick = useMutation({
    mutationFn: (memberUserId: string) =>
      api<RoomDto>('DELETE', `/rooms/${roomId}/members/${memberUserId}`),
    onSuccess: (data) => {
      update(data);
      setKicking(null);
    },
  });
  const changeSettings = useMutation({
    mutationFn: (body: UpdateRoomSettingsRequest) =>
      api<RoomDto>('PUT', `/rooms/${roomId}/settings`, body),
    onSuccess: update,
  });
  const [botLevel, setBotLevel] = useState<BotLevel>('normal');
  /** Who the host is being asked about, while the question is open. */
  const [kicking, setKicking] = useState<RoomMemberDto | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (copyState !== 'copied') return;
    const timer = setTimeout(() => setCopyState('idle'), COPIED_FOR_MS);
    return () => clearTimeout(timer);
  }, [copyState]);
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyState('copied');
    } catch {
      // Refused, or the page is not served securely and has no clipboard at all.
      setCopyState('failed');
    }
  };
  // The phone's own sheet: messaging apps, nearby devices. Desktop browsers mostly lack it.
  const canShare = typeof navigator.share === 'function';
  const share = async (data: ShareData) => {
    try {
      await navigator.share(data);
    } catch (error) {
      // Closing the sheet is an answer, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (data.url) await copy(data.url);
    }
  };
  const games = useQuery(gamesQuery);

  // The room's call can be joined from here by anyone seated in it.
  useVoiceRoom(room.data?.members.some((member) => member.userId === userId) ? roomId : null);

  const gameUi = room.data ? getGameUi(room.data.gameType) : undefined;
  // The table is fetched while everyone is still sitting down, so the match opens at once.
  useEffect(() => {
    gameUi?.preload?.();
  }, [gameUi]);
  const gameConfig = useGameConfig(
    room.data?.gameType ?? '',
    gameUi?.describeSettings !== undefined || gameUi?.SettingsForm !== undefined,
  );

  useDocumentTitle(room.data ? t('roomPage.title', { code: room.data.code }) : null);

  if (room.isLoading) return <RoomSkeleton label={t('roomPage.loading')} />;
  if (room.isError || !room.data) return <p className="error">{errorText(t, room.error)}</p>;

  const data = room.data;
  const me = data.members.find((member) => member.userId === userId);
  const isHost = data.hostUserId === userId;
  const settingsSummary =
    gameUi?.describeSettings && gameConfig.data
      ? gameUi.describeSettings(data.settings, gameConfig.data.config, data.members.length, locale)
      : null;
  const inviteLink = `${window.location.origin}/join/${data.code}`;
  const SettingsForm = gameUi?.SettingsForm;
  const error =
    setReady.error ??
    start.error ??
    leave.error ??
    join.error ??
    addBot.error ??
    removeBot.error ??
    changeSettings.error;
  const game = games.data?.find((definition) => definition.gameType === data.gameType);
  const gameName = game?.displayName ?? data.gameType;
  const isOpen = data.status === 'open';
  const canAddBot =
    isHost && isOpen && game?.supportsBots === true && data.members.length < game.maxPlayers;
  const blocker = startBlocker(data, game);
  const primary = primaryAction(data, userId, blocker);
  const startHint =
    blocker?.kind === 'needPlayers'
      ? t('roomPage.needPlayers', { count: blocker.missing })
      : blocker?.kind === 'notReady'
        ? t('roomPage.waitingReady', { count: blocker.waiting })
        : isHost
          ? t('roomPage.canStart')
          : t('roomPage.waitingHost');
  const readyCount = data.members.filter((member) => member.status === 'ready').length;
  const empty = emptySeats(data, game);

  return (
    <div className="room">
      <Link className="room-back" to="/">
        <span aria-hidden="true">←</span> {t('join.backToLobby')}
      </Link>

      <header className="room-header">
        <GameIcon gameType={data.gameType} displayName={gameName} size="large" />
        <div className="room-header-text">
          <div className="room-title">
            <h1>{gameName}</h1>
            <span className="badge">
              {data.visibility === 'private' ? t('create.private') : t('create.public')}
            </span>
          </div>
          <p className="muted">
            {t('roomPage.title', { code: data.code })}
            {settingsSummary && ` · ${settingsSummary}`}
          </p>
        </div>
      </header>

      {data.status === 'in_match' && data.currentMatchId && (
        <div className="room-banner">
          <span>{t('roomPage.matchInProgress')}</span>
          <Link className="button" to={`/matches/${data.currentMatchId}`}>
            {t('continue.resume')}
          </Link>
        </div>
      )}

      <div className="room-layout">
        <div className="room-main">
          <section className="room-panel room-seats" aria-labelledby="room-seats-title">
            <div className="room-panel-head">
              <h2 id="room-seats-title">
                {t('roomPage.players')}
                <span className="chip">
                  {game
                    ? t('room.seats', { count: data.members.length, max: game.maxPlayers })
                    : data.members.length}
                </span>
              </h2>
              {isOpen && (
                <span className="room-ready-count">
                  {t('roomPage.readyCount', { count: readyCount, total: data.members.length })}
                </span>
              )}
            </div>
            {isOpen && (
              <div className="room-progress" aria-hidden="true">
                <span style={{ width: `${(readyCount / data.members.length) * 100}%` }} />
              </div>
            )}

            <ul className="seat-grid">
              {data.members.map((member) => {
                const isYou = member.userId === userId;
                const isReady = member.status === 'ready';
                const isBot = member.botLevel !== null;
                const className = ['seat', isOpen && isReady ? 'ready' : null, isYou ? 'you' : null]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li key={member.userId} className={className}>
                    <Avatar
                      person={{ userId: member.userId, displayName: member.displayName, isBot }}
                      size="large"
                    />
                    <div className="seat-text">
                      <span className="seat-name">
                        {member.displayName}
                        {isYou && <span className="muted"> ({t('common.you')})</span>}
                      </span>
                      <span className="seat-meta">
                        {member.userId === data.hostUserId && (
                          <span className="badge host">{t('roomPage.host')}</span>
                        )}
                        {member.botLevel && (
                          <span>
                            {t('roomPage.computer', { level: t(BOT_LEVEL_KEYS[member.botLevel]) })}
                          </span>
                        )}
                        {isOpen && (
                          <span className={isReady ? 'seat-status ready' : 'seat-status'}>
                            {isReady ? (
                              <>
                                <span aria-hidden="true">✓ </span>
                                {t('roomPage.ready')}
                              </>
                            ) : (
                              t('roomPage.notReady')
                            )}
                          </span>
                        )}
                      </span>
                    </div>
                    {isBot && isHost && isOpen && (
                      <button
                        type="button"
                        className="seat-remove"
                        title={t('roomPage.removeBot')}
                        aria-label={`${t('roomPage.removeBot')}: ${member.displayName}`}
                        disabled={removeBot.isPending}
                        onClick={() => removeBot.mutate(member.userId)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    )}
                    {!isBot && !isYou && isHost && isOpen && (
                      <button
                        type="button"
                        className="seat-remove"
                        title={t('roomPage.kick')}
                        aria-label={`${t('roomPage.kick')}: ${member.displayName}`}
                        onClick={() => {
                          kick.reset();
                          setKicking(member);
                        }}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    )}
                  </li>
                );
              })}
              {isOpen &&
                Array.from({ length: empty.required + empty.optional }, (_, index) => {
                  const needed = index < empty.required;
                  return (
                    <li
                      key={`empty-${index}`}
                      className={needed ? 'seat empty needed' : 'seat empty'}
                    >
                      <span className="avatar large empty" aria-hidden="true">
                        +
                      </span>
                      <div className="seat-text">
                        <span className="seat-name">{t('roomPage.emptySeat')}</span>
                        <span className="seat-status">
                          {needed ? t('roomPage.seatNeeded') : t('roomPage.seatOpen')}
                        </span>
                      </div>
                    </li>
                  );
                })}
            </ul>
            {isOpen && empty.more > 0 && (
              <p className="muted hint">{t('roomPage.moreSeats', { count: empty.more })}</p>
            )}

            {canAddBot && (
              <div className="room-add-bot">
                <label className="row">
                  <span>{t('roomPage.computerPlayer')}</span>
                  <select
                    value={botLevel}
                    onChange={(event) => setBotLevel(event.target.value as BotLevel)}
                  >
                    {BOT_LEVELS.map((level) => (
                      <option key={level} value={level}>
                        {t(BOT_LEVEL_KEYS[level])}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="secondary"
                  disabled={addBot.isPending}
                  onClick={() => addBot.mutate({ level: botLevel })}
                >
                  <span aria-hidden="true">+ </span>
                  {t('roomPage.addBot')}
                </button>
              </div>
            )}
          </section>

          {isOpen && (
            <div className="room-actions">
              <p className="room-actions-hint" role="status">
                {startHint}
              </p>
              {me && (
                <button
                  type="button"
                  className="link room-leave"
                  disabled={leave.isPending}
                  onClick={() => leave.mutate()}
                >
                  {t('continue.leave')}
                </button>
              )}
              <div className="room-actions-buttons">
                {!me && (
                  <button type="button" disabled={join.isPending} onClick={() => join.mutate()}>
                    {t('roomPage.takeSeat')}
                  </button>
                )}
                {me && (
                  <button
                    type="button"
                    className={primary === 'ready' ? undefined : 'secondary'}
                    disabled={setReady.isPending}
                    onClick={() => setReady.mutate({ ready: me.status !== 'ready' })}
                  >
                    {me.status === 'ready' ? t('roomPage.cancelReady') : t('roomPage.imReady')}
                  </button>
                )}
                {isHost && (
                  <button
                    type="button"
                    className={primary === 'start' ? undefined : 'secondary'}
                    disabled={blocker !== null || start.isPending}
                    onClick={() => start.mutate()}
                  >
                    {t('roomPage.start')}
                  </button>
                )}
              </div>
              {error && (
                <p className="error" role="alert">
                  {errorText(t, error)}
                </p>
              )}
            </div>
          )}
          {!isOpen && error && (
            <p className="error" role="alert">
              {errorText(t, error)}
            </p>
          )}
        </div>

        <div className="room-side">
          <section className="room-panel room-invite" aria-labelledby="room-invite-title">
            <h2 id="room-invite-title">{t('roomPage.invite')}</h2>
            <div className="room-code">
              <span className="room-invite-label">{t('roomPage.code')}</span>
              <strong>{data.code}</strong>
            </div>
            <div className="room-link">
              <span className="room-invite-label">{t('roomPage.inviteLink')}</span>
              <code>{inviteLink}</code>
            </div>
            <div className="room-invite-actions">
              <button
                type="button"
                className={copyState === 'copied' ? 'secondary copied' : 'secondary'}
                onClick={() => void copy(inviteLink)}
              >
                {copyState === 'copied' ? (
                  <>
                    <span aria-hidden="true">✓ </span>
                    {t('roomPage.copied')}
                  </>
                ) : (
                  t('roomPage.copy')
                )}
              </button>
              {canShare && (
                <button
                  type="button"
                  onClick={() =>
                    void share({
                      title: t('roomPage.title', { code: data.code }),
                      text: t('roomPage.shareText', { game: gameName }),
                      url: inviteLink,
                    })
                  }
                >
                  {t('roomPage.share')}
                </button>
              )}
            </div>
            <span className={copyState === 'failed' ? 'error' : 'sr-only'} aria-live="polite">
              {copyState === 'copied' && t('roomPage.copied')}
              {copyState === 'failed' && t('roomPage.copyFailed')}
            </span>
            <p className="muted hint">
              {data.visibility === 'private' ? t('create.privateHint') : t('create.publicHint')}
            </p>
          </section>

          {SettingsForm && gameConfig.data && isHost && isOpen && (
            <section className="room-panel" aria-labelledby="room-settings-title">
              <h2 id="room-settings-title">{t('roomPage.settings')}</h2>
              <SettingsForm
                config={gameConfig.data.config}
                value={data.settings}
                playerCount={data.members.length}
                onChange={(settings) => {
                  // A start refused over the settings is answered by changing them.
                  start.reset();
                  changeSettings.mutate({ settings });
                }}
              />
              <span className="muted hint">{t('roomPage.settingsHint')}</span>
            </section>
          )}
        </div>
      </div>

      {kicking && (
        <ConfirmDialog
          title={t('roomPage.kickTitle', { name: kicking.displayName })}
          confirmLabel={t('roomPage.kickConfirm')}
          pendingLabel={t('roomPage.kicking')}
          pending={kick.isPending}
          error={kick.error}
          danger
          onConfirm={() => kick.mutate(kicking.userId)}
          onClose={() => setKicking(null)}
        >
          <p>{t('roomPage.kickBody')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
