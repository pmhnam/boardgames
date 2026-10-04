import type { GameDefinitionDto, RoomDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { getGameUi } from '../../games/registry';
import { api } from '../../shared/api/http';
import { useT } from '../../shared/i18n/useT';
import { useAuthStore } from '../auth/auth.store';
import { ContinueSection } from './ContinueSection';
import { CreateRoomDialog } from './CreateRoomDialog';
import { GameCard } from './GameCard';
import { JoinCodeForm } from './JoinCodeForm';
import { RetryNotice } from './RetryNotice';
import { RoomList } from './RoomList';
import { partitionRooms } from './rooms';
import './lobby.css';

/** How often the room list is refreshed while the lobby is open. */
const ROOM_LIST_REFRESH_MS = 5000;

const PLACEHOLDER_CARDS = [0, 1, 2, 3];

const isDemo = (game: GameDefinitionDto) => getGameUi(game.gameType)?.card?.demo === true;

export function LobbyPage() {
  const t = useT();
  const user = useAuthStore((state) => state.session?.user);
  const [creating, setCreating] = useState<GameDefinitionDto | null>(null);

  const games = useQuery({
    queryKey: ['games'],
    queryFn: () => api<GameDefinitionDto[]>('GET', '/games'),
  });
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api<RoomDto[]>('GET', '/rooms'),
    refetchInterval: ROOM_LIST_REFRESH_MS,
  });

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
