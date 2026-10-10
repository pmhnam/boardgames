import type { AdminUserDto, Page } from '@bgp/shared-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { useLocale, useT } from '../../shared/i18n/useT';
import { RetryNotice } from '../lobby/RetryNotice';
import { Pagination } from './Pagination';
import { toQuery } from './paging';
import { PlayerBadges } from './PlayerBadges';
import { SearchBox } from './SearchBox';
import { useListSearch } from './useListSearch';

export function PlayersPage() {
  const t = useT();
  const locale = useLocale();
  const { search, page, change } = useListSearch();
  const q = search.get('q') ?? '';
  const bots = search.get('bots') === 'true';

  const query = toQuery({ q, bots: bots ? 'true' : null, ...page });
  const players = useQuery({
    queryKey: ['admin', 'users', query],
    queryFn: () => api<Page<AdminUserDto>>('GET', `/admin/users${query}`),
    placeholderData: keepPreviousData,
  });

  return (
    <section className="card" aria-labelledby="admin-players-title">
      <h2 id="admin-players-title">{t('admin.tab.players')}</h2>
      <p className="muted admin-lead">{t('admin.players.lead')}</p>
      <div className="admin-filters">
        <SearchBox
          label={t('admin.players.search')}
          value={q}
          onSearch={(value) => change({ q: value })}
        />
        <label className="admin-check">
          <input
            type="checkbox"
            checked={bots}
            onChange={(event) => change({ bots: event.target.checked ? 'true' : null })}
          />
          {t('admin.players.includeBots')}
        </label>
      </div>

      {players.isError && (
        <RetryNotice error={players.error} onRetry={() => void players.refetch()} />
      )}
      {players.isLoading && <p className="muted">{t('common.loading')}</p>}
      {players.data?.items.length === 0 && (
        <p className="lobby-empty">{t('admin.players.empty')}</p>
      )}
      {players.data && players.data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">{t('admin.player.name')}</th>
              <th scope="col">{t('admin.player.kind')}</th>
              <th scope="col">{t('admin.player.joined')}</th>
            </tr>
          </thead>
          <tbody>
            {players.data.items.map((user) => (
              <tr key={user.id}>
                <th scope="row">
                  <Link to={`/admin/players/${user.id}`}>{user.displayName}</Link>
                </th>
                <td>
                  <PlayerBadges user={user} />
                </td>
                <td>{new Date(user.createdAt).toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {players.data && (
        <Pagination
          total={players.data.total}
          limit={players.data.limit}
          offset={players.data.offset}
          shown={players.data.items.length}
          onChange={(offset) => change({ offset })}
        />
      )}
    </section>
  );
}
