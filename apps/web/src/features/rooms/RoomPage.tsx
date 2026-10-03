import {
  ClientEvents,
  ServerEvents,
  type GameStartedMessage,
  type RoomDto,
  type SetReadyRequest,
  type StartRoomResponse,
} from '@bgp/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import { useGameConfig } from '../../games/useGameConfig';
import { api, errorMessage } from '../../shared/api/http';
import { PlayerList } from '../../shared/components/PlayerList';
import { useSocket } from '../../shared/websocket/SocketProvider';
import { useAuthStore } from '../auth/auth.store';

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

  const gameUi = room.data ? getGameUi(room.data.gameType) : undefined;
  const gameConfig = useGameConfig(
    room.data?.gameType ?? '',
    gameUi?.describeSettings !== undefined,
  );

  if (room.isLoading) return <p className="muted">Loading room…</p>;
  if (room.isError || !room.data) return <p className="error">{errorMessage(room.error)}</p>;

  const data = room.data;
  const me = data.members.find((member) => member.userId === userId);
  const isHost = data.hostUserId === userId;
  const everyoneReady = data.members.every((member) => member.status === 'ready');
  const settingsSummary =
    gameUi?.describeSettings && gameConfig.data
      ? gameUi.describeSettings(data.settings, gameConfig.data.config)
      : null;
  const inviteLink = `${window.location.origin}/join/${data.code}`;
  const error = setReady.error ?? start.error ?? leave.error ?? join.error;

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
          detail: `${member.userId === data.hostUserId ? 'Host · ' : ''}${
            member.status === 'ready' ? 'Ready' : 'Not ready'
          }`,
        }))}
      />

      {data.status === 'in_match' && data.currentMatchId && (
        <p>
          A match is in progress. <Link to={`/matches/${data.currentMatchId}`}>Open it</Link>
        </p>
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
