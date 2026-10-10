import type { AdminGameDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { useLocale, useT } from '../../shared/i18n/useT';
import { RetryNotice } from '../lobby/RetryNotice';

export const adminGamesQuery = {
  queryKey: ['admin', 'games'],
  queryFn: () => api<AdminGameDto[]>('GET', '/admin/games'),
};

export function ConfigsPage() {
  const t = useT();
  const locale = useLocale();
  const games = useQuery(adminGamesQuery);

  if (games.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (games.isError)
    return <RetryNotice error={games.error} onRetry={() => void games.refetch()} />;

  return (
    <section className="card" aria-labelledby="admin-configs-title">
      <h2 id="admin-configs-title">{t('admin.tab.configs')}</h2>
      <p className="muted admin-lead">{t('admin.configs.lead')}</p>
      <table>
        <thead>
          <tr>
            <th scope="col">{t('admin.configs.game')}</th>
            <th scope="col">{t('admin.configs.current')}</th>
            <th scope="col">{t('admin.configs.publishedAt')}</th>
            <th scope="col">{t('admin.configs.engine')}</th>
          </tr>
        </thead>
        <tbody>
          {games.data?.map((game) => (
            <tr key={game.gameType}>
              <th scope="row">
                {/* The name is the way in, so it is reachable without scrolling the table. */}
                <Link to={`/admin/configs/${game.gameType}`}>{game.displayName}</Link>
              </th>
              <td>v{game.currentVersion}</td>
              <td>{new Date(game.currentPublishedAt).toLocaleString(locale)}</td>
              <td>v{game.engineVersion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
