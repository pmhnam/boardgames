import {
  ClientEvents,
  ServerEvents,
  type GameDefinitionDto,
  type RoomDto,
} from '@bgp/shared-types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { gamesQuery } from '../../games/gamesQuery';
import { getGameUi } from '../../games/registry';
import { api } from '../../shared/api/http';
import { useT } from '../../shared/i18n/useT';
import { useSocket } from '../../shared/websocket/SocketProvider';
import { useAuthStore } from '../auth/auth.store';
import { ContinueSection } from './ContinueSection';
import { CreateRoomDialog } from './CreateRoomDialog';
import { GameCard } from './GameCard';
import { JoinCodeForm } from './JoinCodeForm';
import { RetryNotice } from './RetryNotice';
import { RoomList } from './RoomList';
import { partitionRooms } from './rooms';
import './lobby.css';

/**
 * The server says when the room list has changed, so this is only the net under that: a notice
 * lost to a connection that dropped at the wrong moment is made up for within the minute.
 */
const ROOM_LIST_REFRESH_MS = 60_000;

const PLACEHOLDER_CARDS = [0, 1, 2, 3];

const isDemo = (game: GameDefinitionDto) => getGameUi(game.gameType)?.card?.demo === true;

export function LobbyPage() {
  const t = useT();
  const user = useAuthStore((state) => state.session?.user);
  const [creating, setCreating] = useState<GameDefinitionDto | null>(null);
  const queryClient = useQueryClient();
  const socket = useSocket();

  const games = useQuery(gamesQuery);
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api<RoomDto[]>('GET', '/rooms'),
    refetchInterval: ROOM_LIST_REFRESH_MS,
  });

  // Fetch the list again when told it changed. Subscribing on every `connect` covers reconnects;
  // coming back from one also fetches, for what changed while the connection was down.
  useEffect(() => {
    if (!socket) return;
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ['rooms'] });
    let subscribed = false;
    const subscribe = () => {
      socket.emit(ClientEvents.LobbyJoin);
      if (subscribed) refresh();
      subscribed = true;
    };
    socket.on('connect', subscribe);
    socket.on(ServerEvents.LobbyChanged, refresh);
    if (socket.connected) subscribe();

    return () => {
      socket.off('connect', subscribe);
      socket.off(ServerEvents.LobbyChanged, refresh);
      socket.emit(ClientEvents.LobbyLeave);
    };
  }, [socket, queryClient]);

  // The server's order, with the demos moved behind the games people came for.
  const gameList = useMemo(
    () => [...(games.data ?? [])].sort((a, b) => Number(isDemo(a)) - Number(isDemo(b))),
    [games.data],
  );
  const gameByType = useMemo(
    () => new Map(gameList.map((game) => [game.gameType, game])),
    [gameList],
  );
  const { mine, others } = useMemo(
    () => partitionRooms(rooms.data ?? [], gameList, user?.id),
    [rooms.data, gameList, user?.id],
  );
  const joinableByGame = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { room, standing } of others) {
      if (standing === 'joinable') counts.set(room.gameType, (counts.get(room.gameType) ?? 0) + 1);
    }
    return counts;
  }, [others]);

  return (
    <div className="lobby">
      <div className="lobby-hero">
        <div className="lobby-hero-text">
          <h1>{t('lobby.greeting', { name: user?.displayName ?? '' })}</h1>
          <p className="muted">{t('lobby.subtitle')}</p>
        </div>
        <JoinCodeForm />
      </div>

      <ContinueSection rooms={mine} gameByType={gameByType} />

      <section aria-labelledby="games-title">
        <h2 id="games-title">{t('lobby.games')}</h2>
        {games.isPending ? (
          <ul className="game-grid" aria-busy="true">
            {PLACEHOLDER_CARDS.map((card) => (
              <li key={card} className="game-card placeholder skeleton" aria-hidden="true" />
            ))}
          </ul>
        ) : games.isError ? (
          <RetryNotice error={games.error} onRetry={() => void games.refetch()} />
        ) : gameList.length === 0 ? (
          <p className="lobby-empty">{t('lobby.noGames')}</p>
        ) : (
          <ul className="game-grid">
            {gameList.map((game) => (
              <GameCard
                key={game.gameType}
                game={game}
                joinableRooms={joinableByGame.get(game.gameType) ?? 0}
                onCreate={() => setCreating(game)}
              />
            ))}
          </ul>
        )}
      </section>

      <RoomList
        rooms={others}
        gameByType={gameByType}
        isPending={rooms.isPending}
        error={rooms.error}
        onRetry={() => void rooms.refetch()}
      />

      {creating && (
        <CreateRoomDialog
          key={creating.gameType}
          game={creating}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
}
