import {
  type AddBotRequest,
  type UpdateRoomSettingsRequest,
  type BotLevel,
  type GameDefinitionDto,
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
import { getGameUi } from '../../games/registry';
import { useGameConfig } from '../../games/useGameConfig';
import { api } from '../../shared/api/http';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { PlayerList } from '../../shared/components/PlayerList';
import { errorText } from '../../shared/i18n/errors';
import { useLocale, useT } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';
import { useSocket } from '../../shared/websocket/SocketProvider';
import { useAuthStore } from '../auth/auth.store';
import { primaryAction, startBlocker } from './room-actions';
import './room.css';

const BOT_LEVELS: BotLevel[] = ['easy', 'normal', 'hard'];
const BOT_LEVEL_KEYS: Record<BotLevel, MessageKey> = {
  easy: 'botLevel.easy',
  normal: 'botLevel.normal',
  hard: 'botLevel.hard',
};

/** How long the copy button says it worked. */
const COPIED_FOR_MS = 2000;

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
  const games = useQuery({
    queryKey: ['games'],
    queryFn: () => api<GameDefinitionDto[]>('GET', '/games'),
  });

  const gameUi = room.data ? getGameUi(room.data.gameType) : undefined;
  const gameConfig = useGameConfig(
    room.data?.gameType ?? '',
    gameUi?.describeSettings !== undefined || gameUi?.SettingsForm !== undefined,
  );

  if (room.isLoading) return <p className="muted">{t('roomPage.loading')}</p>;
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
  const canAddBot =
    isHost &&
    data.status === 'open' &&
    game?.supportsBots === true &&
    data.members.length < game.maxPlayers;
  const blocker = startBlocker(data, game);
  const primary = primaryAction(data, userId, blocker);
  const startHint =
    blocker?.kind === 'needPlayers'
      ? t('roomPage.needPlayers', { count: blocker.missing })
      : blocker?.kind === 'notReady'
        ? t('roomPage.waitingReady', { count: blocker.waiting })
        : isHost
          ? null
          : t('roomPage.waitingHost');

  return (
    <div className="card">
      <header className="room-header">
        <h1>{t('roomPage.title', { code: data.code })}</h1>
        <p className="muted">
          {game?.displayName ?? data.gameType}
          {settingsSummary && ` · ${settingsSummary}`}
        </p>
      </header>

      <div className="room-invite">
        <span className="room-invite-label">{t('roomPage.inviteLink')}</span>
        <code>{inviteLink}</code>
        <button type="button" className="secondary" onClick={() => void copy(inviteLink)}>
          {copyState === 'copied' ? t('roomPage.copied') : t('roomPage.copy')}
        </button>
        <span className={copyState === 'failed' ? 'error' : 'sr-only'} aria-live="polite">
          {copyState === 'copied' && t('roomPage.copied')}
          {copyState === 'failed' && t('roomPage.copyFailed')}
        </span>
      </div>

      <PlayerList
        players={data.members.map((member) => ({
          id: member.userId,
          name: member.displayName,
          isYou: member.userId === userId,
          detail: (
            <span className="row">
              {member.userId === data.hostUserId && `${t('roomPage.host')} · `}
              {member.botLevel &&
                `${t('roomPage.computer', { level: t(BOT_LEVEL_KEYS[member.botLevel]) })} · `}
              {member.status === 'ready' ? t('roomPage.ready') : t('roomPage.notReady')}
              {member.botLevel && isHost && data.status === 'open' && (
                <button
                  type="button"
                  className="link"
                  disabled={removeBot.isPending}
                  onClick={() => removeBot.mutate(member.userId)}
                >
                  {t('roomPage.removeBot')}
                </button>
              )}
              {!member.botLevel && member.userId !== userId && isHost && data.status === 'open' && (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    kick.reset();
                    setKicking(member);
                  }}
                >
                  {t('roomPage.kick')}
                </button>
              )}
            </span>
          ),
        }))}
      />

      {data.status === 'in_match' && data.currentMatchId && (
        <p>
          {t('roomPage.matchInProgress')}{' '}
          <Link to={`/matches/${data.currentMatchId}`}>{t('continue.resume')}</Link>
        </p>
      )}

      {SettingsForm && gameConfig.data && isHost && data.status === 'open' && (
        <div className="stack-small">
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
        </div>
      )}

      {canAddBot && (
        <div className="row wrap">
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
            {t('roomPage.addBot')}
          </button>
        </div>
      )}

      {data.status === 'open' && (
        <div className="room-actions">
          <div className="row wrap">
            {!me && (
              <button type="button" onClick={() => join.mutate()}>
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
            {me && (
              <button type="button" className="secondary" onClick={() => leave.mutate()}>
                {t('continue.leave')}
              </button>
            )}
          </div>
          {startHint && <p className="muted hint">{startHint}</p>}
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {errorText(t, error)}
        </p>
      )}

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
