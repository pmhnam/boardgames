import type { AdminMatchDto, MatchStatus, Page } from '@bgp/shared-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { useLocale, useT } from '../../shared/i18n/useT';
import { RetryNotice } from '../lobby/RetryNotice';
import { adminGamesQuery } from './ConfigsPage';
import { MATCH_STATUS_KEYS, MatchStatusBadge } from './MatchStatusBadge';
import { Pagination } from './Pagination';
import { toQuery } from './paging';
import { useListSearch } from './useListSearch';

const STATUSES: MatchStatus[] = ['playing', 'finished', 'abandoned'];
/** Matches start, move and end on their own, so the list keeps itself current. */
const REFRESH_MS = 10_000;

export function MatchesPage() {
  const t = useT();
  const locale = useLocale();
  const { search, page, change } = useListSearch();
  const gameType = search.get('gameType') ?? '';
  const status = search.get('status') ?? '';

  const games = useQuery(adminGamesQuery);
  const gameName = (type: string) =>
    games.data?.find((game) => game.gameType === type)?.displayName ?? type;

  const query = toQuery({ gameType, status, ...page });
  const matches = useQuery({
    queryKey: ['admin', 'matches', query],
    queryFn: () => api<Page<AdminMatchDto>>('GET', `/admin/matches${query}`),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });

  return (
    <section className="card" aria-labelledby="admin-matches-title">
      <h2 id="admin-matches-title">{t('admin.tab.matches')}</h2>
      <p className="muted admin-lead">{t('admin.matches.lead')}</p>
      <div className="admin-filters">
        <label>
          {t('admin.filter.game')}
          <select value={gameType} onChange={(event) => change({ gameType: event.target.value })}>
            <option value="">{t('admin.filter.all')}</option>
            {games.data?.map((game) => (
              <option key={game.gameType} value={game.gameType}>
                {game.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('admin.filter.status')}
          <select value={status} onChange={(event) => change({ status: event.target.value })}>
            <option value="">{t('admin.filter.all')}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(MATCH_STATUS_KEYS[value])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {matches.isError && (
        <RetryNotice error={matches.error} onRetry={() => void matches.refetch()} />
      )}
      {matches.isLoading && <p className="muted">{t('common.loading')}</p>}
      {matches.data?.items.length === 0 && (
        <p className="lobby-empty">{t('admin.matches.empty')}</p>
      )}
      {matches.data && matches.data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">{t('admin.match.game')}</th>
              <th scope="col">{t('admin.match.status')}</th>
              <th scope="col">{t('admin.match.players')}</th>
              <th scope="col">{t('admin.match.room')}</th>
              <th scope="col">{t('admin.match.started')}</th>
              <th scope="col">{t('admin.match.lastMove')}</th>
            </tr>
          </thead>
          <tbody>
            {matches.data.items.map((match) => (
              <tr key={match.id}>
                <th scope="row">
                  <Link to={`/admin/matches/${match.id}`}>{gameName(match.gameType)}</Link>
                </th>
                <td>
                  <span className="row">
                    <MatchStatusBadge status={match.status} />
                    {match.engineOutdated && match.status === 'playing' && (
                      <span className="badge warning">{t('admin.match.outdated')}</span>
                    )}
                  </span>
                </td>
                <td>{match.players.map((player) => player.displayName).join(', ')}</td>
                <td>{match.roomCode}</td>
                <td>{new Date(match.createdAt).toLocaleString(locale)}</td>
                <td>
                  {match.lastActionAt
                    ? new Date(match.lastActionAt).toLocaleString(locale)
                    : t('admin.match.noMoves')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {matches.data && (
        <Pagination
          total={matches.data.total}
          limit={matches.data.limit}
          offset={matches.data.offset}
          shown={matches.data.items.length}
          onChange={(offset) => change({ offset })}
        />
      )}
    </section>
  );
}
