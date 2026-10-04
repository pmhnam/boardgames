import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { joinByCode } from './joinRoom';

/** Target of invite links: resolves the code, takes a seat, then opens the room. */
export function JoinByCodePage() {
  const t = useT();
  const { code = '' } = useParams();

  const joined = useQuery({ queryKey: ['join', code], queryFn: () => joinByCode(code) });

  if (joined.data) return <Navigate to={`/rooms/${joined.data.id}`} replace />;
  if (joined.isError) {
    return (
      <div className="card narrow">
        <p className="error" role="alert">
          {errorText(t, joined.error)}
        </p>
        <Link to="/">{t('join.backToLobby')}</Link>
      </div>
    );
  }
  return <p className="muted">{t('join.joining', { code })}</p>;
}
