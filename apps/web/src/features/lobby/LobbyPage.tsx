import type { CreateRoomRequest, GameDefinitionDto, RoomDto } from '@bgp/shared-types';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorMessage } from '../../shared/api/http';

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
            <li key={game.gameType}>
              <div>
                <strong>{game.displayName}</strong>
                <div className="muted">
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers} players`
                    : `${game.minPlayers}–${game.maxPlayers} players`}
                </div>
              </div>
              <button
                type="button"
                disabled={createRoom.isPending}
                onClick={() => createRoom.mutate({ gameType: game.gameType })}
              >
                Create room
              </button>
            </li>
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
