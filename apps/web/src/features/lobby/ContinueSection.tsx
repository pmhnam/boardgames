import type { GameDefinitionDto, RoomDto } from '@bgp/shared-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { GameIcon } from './GameIcon';
import { RoomFacts, roomHostLine } from './RoomRow';

function MyRoom({ room, game }: { room: RoomDto; game: GameDefinitionDto | undefined }) {
  const t = useT();
  const queryClient = useQueryClient();
  const refreshRooms = () => void queryClient.invalidateQueries({ queryKey: ['rooms'] });
  const leave = useMutation({
    mutationFn: () => api<RoomDto>('POST', `/rooms/${room.id}/leave`),
    onSuccess: refreshRooms,
    // Most likely the match started meanwhile, and the list here is out of date.
    onError: refreshRooms,
  });

  const gameName = game?.displayName ?? room.gameType;
  const matchId = room.status === 'in_match' ? room.currentMatchId : null;

  return (
    <li className="room-row">
      <GameIcon gameType={room.gameType} displayName={gameName} />
      <div className="room-row-main">
        <span className="room-row-title">
          <strong>{gameName}</strong>
          <span className="muted">{roomHostLine(t, room)}</span>
          {matchId ? (
            <span className="badge warning">{t('room.playing')}</span>
          ) : (
            <span className="badge success">{t('continue.waiting')}</span>
          )}
          {room.visibility === 'private' && <span className="badge">{t('room.private')}</span>}
        </span>
        <RoomFacts room={room} game={game} />
        {leave.isError && (
          <span className="error" role="alert">
            {errorText(t, leave.error)}
          </span>
        )}
      </div>
      <div className="room-row-action">
        {matchId ? (
          <Link className="button" to={`/matches/${matchId}`}>
            {t('continue.resume')}
          </Link>
        ) : (
          <>
            {/* A room goes back to waiting after its match, so there has to be a way out. */}
            <button
              type="button"
              className="secondary"
              disabled={leave.isPending}
              aria-label={`${t('continue.leave')}: ${gameName}, ${room.code}`}
              onClick={() => leave.mutate()}
            >
              {t('continue.leave')}
            </button>
            <Link className="button" to={`/rooms/${room.id}`}>
              {t('room.open')}
            </Link>
          </>
        )}
      </div>
    </li>
  );
}

/** The rooms the viewer already has a seat in. Absent when there are none. */
export function ContinueSection({
  rooms,
  gameByType,
}: {
  rooms: RoomDto[];
  gameByType: ReadonlyMap<string, GameDefinitionDto>;
}) {
  const t = useT();
  if (rooms.length === 0) return null;

  return (
    <section aria-labelledby="continue-title">
      <h2 id="continue-title">{t('continue.title')}</h2>
      <ul className="room-rows mine">
        {rooms.map((room) => (
          <MyRoom key={room.id} room={room} game={gameByType.get(room.gameType)} />
        ))}
      </ul>
    </section>
  );
}
