import type { CreateRoomRequest, GameDefinitionDto, RoomDto } from '@bgp/shared-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import type { RoomSettings } from '../../games/types';
import { useGameConfig } from '../../games/useGameConfig';
import { api, errorMessage } from '../../shared/api/http';
import { useAuthStore } from '../auth/auth.store';

/** How often the room list is refreshed while the lobby is open. */
const ROOM_LIST_REFRESH_MS = 5000;

function playerRange(game: GameDefinitionDto): string {
  return game.minPlayers === game.maxPlayers
    ? `${game.minPlayers} players`
    : `${game.minPlayers}–${game.maxPlayers} players`;
}

/** What someone looking at the lobby can do with a room. */
function RoomAction({
  room,
  game,
  userId,
}: {
  room: RoomDto;
  game: GameDefinitionDto;
  userId: string | undefined;
}) {
  if (room.members.some((member) => member.userId === userId)) {
    return <Link to={`/rooms/${room.id}`}>Open</Link>;
  }
  if (room.status === 'open') {
    return room.members.length < game.maxPlayers ? (
      <Link to={`/join/${room.code}`}>Join</Link>
    ) : (
      <span className="muted">Full</span>
    );
  }
  return room.currentMatchId && game.supportsSpectators ? (
    <Link to={`/matches/${room.currentMatchId}`}>Watch</Link>
  ) : (
    <span className="muted">Playing</span>
  );
}

/** One game: start a room for it, and the rooms already there. */
function GameSection({
  game,
  rooms,
  disabled,
  onCreate,
}: {
  game: GameDefinitionDto;
  rooms: RoomDto[];
  disabled: boolean;
  onCreate(request: Omit<CreateRoomRequest, 'gameType'>): void;
}) {
  const userId = useAuthStore((state) => state.session?.user.id);
  const ui = getGameUi(game.gameType);
  const SettingsForm = ui?.SettingsForm;
  const config = useGameConfig(game.gameType, ui?.SettingsForm !== undefined);
  const [settings, setSettings] = useState<RoomSettings>({});
  const [isPrivate, setIsPrivate] = useState(false);

  return (
    <section className="card" aria-label={game.displayName}>
      <div className="game-header">
        <div className="stack-small">
          <h2>
            {game.displayName} <span className="muted">· {playerRange(game)}</span>
          </h2>
          {SettingsForm && config.data && (
            <SettingsForm config={config.data.config} value={settings} onChange={setSettings} />
          )}
          <label className="row">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
            />
            <span>Private (invite link only)</span>
          </label>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onCreate({
              visibility: isPrivate ? 'private' : 'public',
              // Nothing picked: let the server apply the game's defaults.
              settings: Object.keys(settings).length > 0 ? settings : undefined,
            })
          }
        >
          Create room
        </button>
      </div>

      {rooms.length === 0 ? (
        <p className="muted">No rooms yet.</p>
      ) : (
        <ul className="room-list">
          {rooms.map((room) => {
            const host = room.members.find((member) => member.userId === room.hostUserId);
            const summary =
              ui?.describeSettings && config.data
                ? ui.describeSettings(room.settings, config.data.config)
                : null;
            return (
              <li key={room.id}>
                <div className="stack-small">
                  <span>
                    <strong>{room.code}</strong>
                    <span className="muted"> · {host?.displayName ?? 'Unknown'}’s room</span>
                    {room.visibility === 'private' && <span className="muted"> · private</span>}
                  </span>
                  <span className="muted">
                    {room.members.length}/{game.maxPlayers} players
                    {room.status === 'in_match' && ' · playing'}
                    {summary && ` · ${summary}`}
                  </span>
                </div>
                <RoomAction room={room} game={game} userId={userId} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function LobbyPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const games = useQuery({
    queryKey: ['games'],
    queryFn: () => api<GameDefinitionDto[]>('GET', '/games'),
  });
  const rooms = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api<RoomDto[]>('GET', '/rooms'),
    refetchInterval: ROOM_LIST_REFRESH_MS,
  });

  const createRoom = useMutation({
    mutationFn: (body: CreateRoomRequest) => api<RoomDto>('POST', '/rooms', body),
    onSuccess: (room) => navigate(`/rooms/${room.id}`),
  });

  const join = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim()) navigate(`/join/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="stack">
      <h1>Games and rooms</h1>
      {games.isLoading && <p className="muted">Loading games…</p>}
      {games.isError && <p className="error">{errorMessage(games.error)}</p>}
      {rooms.isError && <p className="error">{errorMessage(rooms.error)}</p>}
      {createRoom.isError && <p className="error">{errorMessage(createRoom.error)}</p>}

      {games.data?.map((game) => (
        <GameSection
          key={game.gameType}
          game={game}
          rooms={(rooms.data ?? []).filter((room) => room.gameType === game.gameType)}
          disabled={createRoom.isPending}
          onCreate={(request) => createRoom.mutate({ gameType: game.gameType, ...request })}
        />
      ))}

      <form className="card" onSubmit={join}>
        <h2>Join with a code</h2>
        <div className="row">
          <input
            aria-label="Room code"
            placeholder="ABC123"
            value={code}
            maxLength={6}
            onChange={(event) => setCode(event.target.value)}
          />
          <button type="submit" disabled={!code.trim()}>
            Join
          </button>
        </div>
      </form>
    </div>
  );
}
