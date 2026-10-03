import type { CreateRoomRequest, GameDefinitionDto, RoomDto } from '@bgp/shared-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGameUi } from '../../games/registry';
import type { RoomSettings } from '../../games/types';
import { useGameConfig } from '../../games/useGameConfig';
import { api, errorMessage } from '../../shared/api/http';

function GameRow({
  game,
  disabled,
  onCreate,
}: {
  game: GameDefinitionDto;
  disabled: boolean;
  onCreate(settings: RoomSettings | undefined): void;
}) {
  const SettingsForm = getGameUi(game.gameType)?.SettingsForm;
  const config = useGameConfig(game.gameType, SettingsForm !== undefined);
  const [settings, setSettings] = useState<RoomSettings>({});

  return (
    <li>
      <div className="stack-small">
        <strong>{game.displayName}</strong>
        <div className="muted">
          {game.minPlayers === game.maxPlayers
            ? `${game.minPlayers} players`
            : `${game.minPlayers}–${game.maxPlayers} players`}
        </div>
        {SettingsForm && config.data && (
          <SettingsForm config={config.data.config} value={settings} onChange={setSettings} />
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        // No form, or nothing picked: let the server apply the game's defaults.
        onClick={() => onCreate(Object.keys(settings).length > 0 ? settings : undefined)}
      >
        Create room
      </button>
    </li>
  );
}

export function LobbyPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const games = useQuery({
    queryKey: ['games'],
    queryFn: () => api<GameDefinitionDto[]>('GET', '/games'),
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
      <section className="card">
        <h1>Start a room</h1>
        {games.isLoading && <p className="muted">Loading games…</p>}
        {games.isError && <p className="error">{errorMessage(games.error)}</p>}
        <ul className="game-list">
          {games.data?.map((game) => (
            <GameRow
              key={game.gameType}
              game={game}
              disabled={createRoom.isPending}
              onCreate={(settings) => createRoom.mutate({ gameType: game.gameType, settings })}
            />
          ))}
        </ul>
        {createRoom.isError && <p className="error">{errorMessage(createRoom.error)}</p>}
      </section>

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
