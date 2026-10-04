import {
  type AddBotRequest,
  type UpdateRoomSettingsRequest,
  type BotLevel,
  type GameDefinitionDto,
  ClientEvents,
  ServerEvents,
  type GameStartedMessage,
  type RoomDto,
  type SetReadyRequest,
  type StartRoomResponse,
} from '@bgp/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import { useGameConfig } from '../../games/useGameConfig';
import { api, errorMessage } from '../../shared/api/http';
import { PlayerList } from '../../shared/components/PlayerList';
import { useSocket } from '../../shared/websocket/SocketProvider';
import { useAuthStore } from '../auth/auth.store';

const BOT_LEVELS: BotLevel[] = ['easy', 'normal', 'hard'];
const BOT_LEVEL_LABELS: Record<BotLevel, string> = { easy: 'Dễ', normal: 'Thường', hard: 'Khó' };

export function RoomPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const socket = useSocket();
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
      if (updated.id === roomId) queryClient.setQueryData(['room', roomId], updated);
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
  }, [socket, roomId, queryClient, navigate]);

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
  const changeSettings = useMutation({
    mutationFn: (body: UpdateRoomSettingsRequest) =>
      api<RoomDto>('PUT', `/rooms/${roomId}/settings`, body),
    onSuccess: update,
  });
  const [botLevel, setBotLevel] = useState<BotLevel>('normal');
  const games = useQuery({
    queryKey: ['games'],
    queryFn: () => api<GameDefinitionDto[]>('GET', '/games'),
  });

  const gameUi = room.data ? getGameUi(room.data.gameType) : undefined;
  const gameConfig = useGameConfig(
    room.data?.gameType ?? '',
    gameUi?.describeSettings !== undefined || gameUi?.SettingsForm !== undefined,
  );

  if (room.isLoading) return <p className="muted">Loading room…</p>;
  if (room.isError || !room.data) return <p className="error">{errorMessage(room.error)}</p>;

  const data = room.data;
  const me = data.members.find((member) => member.userId === userId);
  const isHost = data.hostUserId === userId;
  const everyoneReady = data.members.every((member) => member.status === 'ready');
  const settingsSummary =
    gameUi?.describeSettings && gameConfig.data
      ? gameUi.describeSettings(data.settings, gameConfig.data.config, data.members.length)
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

  return (
    <div className="card">
      <h1>Room {data.code}</h1>
      <p className="muted">
        {data.gameType}
        {settingsSummary && ` · ${settingsSummary}`} · invite link: <code>{inviteLink}</code>{' '}
        <button
          type="button"
          className="link"
          onClick={() => void navigator.clipboard.writeText(inviteLink)}
        >
          Copy
        </button>
      </p>

      <PlayerList
        players={data.members.map((member) => ({
          id: member.userId,
          name: member.displayName,
          isYou: member.userId === userId,
          detail: (
            <span className="row">
              {member.userId === data.hostUserId && 'Host · '}
              {member.botLevel && `Computer (${BOT_LEVEL_LABELS[member.botLevel]}) · `}
              {member.status === 'ready' ? 'Ready' : 'Not ready'}
              {member.botLevel && isHost && data.status === 'open' && (
                <button
                  type="button"
                  className="link"
                  disabled={removeBot.isPending}
                  onClick={() => removeBot.mutate(member.userId)}
                >
                  Remove
                </button>
              )}
            </span>
          ),
        }))}
      />

      {data.status === 'in_match' && data.currentMatchId && (
        <p>
          A match is in progress. <Link to={`/matches/${data.currentMatchId}`}>Open it</Link>
        </p>
      )}

      {SettingsForm && gameConfig.data && isHost && data.status === 'open' && (
        <div className="stack-small">
          <SettingsForm
            config={gameConfig.data.config}
            value={data.settings}
            playerCount={data.members.length}
            onChange={(settings) => changeSettings.mutate({ settings })}
          />
          <span className="muted hint">
            Changing this asks everyone to confirm they are ready again.
          </span>
        </div>
      )}

      {canAddBot && (
        <div className="row wrap">
          <label className="row">
            <span>Computer player</span>
            <select
              value={botLevel}
              onChange={(event) => setBotLevel(event.target.value as BotLevel)}
            >
              {BOT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {BOT_LEVEL_LABELS[level]}
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
            Add bot
          </button>
        </div>
      )}

      {data.status === 'open' && (
        <div className="row">
          {!me && (
            <button type="button" onClick={() => join.mutate()}>
              Take a seat
            </button>
          )}
          {me && (
            <button
              type="button"
              disabled={setReady.isPending}
              onClick={() => setReady.mutate({ ready: me.status !== 'ready' })}
            >
              {me.status === 'ready' ? 'Not ready' : "I'm ready"}
            </button>
          )}
          {isHost && (
            <button
              type="button"
              disabled={!everyoneReady || start.isPending}
              onClick={() => start.mutate()}
            >
              Start match
            </button>
          )}
          {me && (
            <button type="button" className="secondary" onClick={() => leave.mutate()}>
              Leave
            </button>
          )}
        </div>
      )}

      {error && <p className="error">{errorMessage(error)}</p>}
    </div>
  );
}
