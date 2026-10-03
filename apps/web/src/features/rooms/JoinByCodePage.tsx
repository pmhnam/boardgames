import type { RoomDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { api, errorMessage } from '../../shared/api/http';

/** Target of invite links: resolves the code, takes a seat, then opens the room. */
export function JoinByCodePage() {
  const { code = '' } = useParams();

  const joined = useQuery({
    queryKey: ['join', code],
    queryFn: async () => {
      const room = await api<RoomDto>('GET', `/rooms/by-code/${encodeURIComponent(code)}`);
      return api<RoomDto>('POST', `/rooms/${room.id}/join`);
    },
  });

  if (joined.data) return <Navigate to={`/rooms/${joined.data.id}`} replace />;
  if (joined.isError) {
    return (
      <div className="card narrow">
        <p className="error">{errorMessage(joined.error)}</p>
        <Link to="/">Back to lobby</Link>
      </div>
    );
  }
  return <p className="muted">Joining room {code}…</p>;
}
