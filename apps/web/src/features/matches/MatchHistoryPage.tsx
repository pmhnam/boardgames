import type { GameDefinitionDto, MatchDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { playerName } from '../../games/types';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useLocale, useT, type Translate } from '../../shared/i18n/useT';
import { useAuthStore } from '../auth/auth.store';

function outcome(t: Translate, match: MatchDto): string {
  if (match.status === 'playing') return t('room.playing');
  if (match.status === 'abandoned') return t('history.abandoned');
  const winners = (match.result?.winnerPlayerIds ?? []).map((id) => playerName(match.players, id));
  return t('history.wonBy', { names: winners.join(' & ') });
}

export function MatchHistoryPage() {
  const t = useT();
  const locale = useLocale();
  const userId = useAuthStore((state) => state.session?.user.id);
  const matches = useQuery({
    queryKey: ['matches', userId],
    queryFn: () => api<MatchDto[]>('GET', `/users/${userId}/matches`),
    enabled: userId !== undefined,
  });
  // For the games' names. Shared with the lobby, so usually already loaded.
  const games = useQuery({
    queryKey: ['games'],
    queryFn: () => api<GameDefinitionDto[]>('GET', '/games'),
  });
  const gameName = (gameType: string) =>
    games.data?.find((game) => game.gameType === gameType)?.displayName ?? gameType;

  if (matches.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (matches.isError) return <p className="error">{errorText(t, matches.error)}</p>;

  return (
    <div className="card">
      <h1>{t('nav.history')}</h1>
      {matches.data?.length === 0 && <p className="muted">{t('history.empty')}</p>}
      <table>
        <tbody>
          {matches.data?.map((match) => (
            <tr key={match.id}>
              <td>{new Date(match.createdAt).toLocaleString(locale)}</td>
              <td>{gameName(match.gameType)}</td>
              <td>{match.players.map((player) => player.displayName).join(' vs ')}</td>
              <td>{outcome(t, match)}</td>
              <td>
                {match.status === 'playing' ? (
                  <Link to={`/matches/${match.id}`}>{t('continue.resume')}</Link>
                ) : (
                  <Link to={`/matches/${match.id}/replay`}>{t('history.replay')}</Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
