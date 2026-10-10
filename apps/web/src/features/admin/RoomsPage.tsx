import type { AdminRoomDto, Page, RoomStatus } from '@bgp/shared-types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { useLocale, useT } from '../../shared/i18n/useT';
import { RetryNotice } from '../lobby/RetryNotice';
import { countBots } from '../lobby/rooms';
import { adminGamesQuery } from './ConfigsPage';
import { Pagination } from './Pagination';
import { toQuery } from './paging';
import { ROOM_STATUS_KEYS, RoomStatusBadge } from './RoomStatusBadge';
import { SearchBox } from './SearchBox';
import { useListSearch } from './useListSearch';

const STATUSES: RoomStatus[] = ['open', 'in_match', 'closed'];
/** Rooms fill, start and empty on their own, so the list keeps itself current. */
const REFRESH_MS = 10_000;

export function RoomsPage() {
  const t = useT();
  const locale = useLocale();
  const { search, page, change } = useListSearch();
  const gameType = search.get('gameType') ?? '';
  const status = search.get('status') ?? '';
  const q = search.get('q') ?? '';

  const games = useQuery(adminGamesQuery);
  const gameName = (type: string) =>
    games.data?.find((game) => game.gameType === type)?.displayName ?? type;

  const query = toQuery({ gameType, status, q, ...page });
  const rooms = useQuery({
    queryKey: ['admin', 'rooms', query],
    queryFn: () => api<Page<AdminRoomDto>>('GET', `/admin/rooms${query}`),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  });

  return (
    <section className="card" aria-labelledby="admin-rooms-title">
      <h2 id="admin-rooms-title">{t('admin.tab.rooms')}</h2>
      <p className="muted admin-lead">{t('admin.rooms.lead')}</p>
      <div className="admin-filters">
        <SearchBox
          label={t('admin.rooms.search')}
          value={q}
          onSearch={(value) => change({ q: value })}
        />
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
                {t(ROOM_STATUS_KEYS[value])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {rooms.isError && <RetryNotice error={rooms.error} onRetry={() => void rooms.refetch()} />}
      {rooms.isLoading && <p className="muted">{t('common.loading')}</p>}
      {rooms.data?.items.length === 0 && <p className="lobby-empty">{t('admin.rooms.empty')}</p>}
      {rooms.data && rooms.data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th scope="col">{t('admin.room.code')}</th>
              <th scope="col">{t('admin.filter.status')}</th>
              <th scope="col">{t('admin.filter.game')}</th>
              <th scope="col">{t('admin.room.host')}</th>
              <th scope="col">{t('admin.room.members')}</th>
              <th scope="col">{t('admin.room.visibility')}</th>
              <th scope="col">{t('admin.room.created')}</th>
            </tr>
          </thead>
          <tbody>
            {rooms.data.items.map((room) => {
              const bots = countBots(room);
              return (
                <tr key={room.id}>
                  <th scope="row">
                    <Link to={`/admin/rooms/${room.id}`} className="admin-code-text">
                      {room.code}
                    </Link>
                  </th>
                  <td>
                    <RoomStatusBadge status={room.status} />
                  </td>
                  <td>{gameName(room.gameType)}</td>
                  <td>{room.hostDisplayName}</td>
                  <td>
                    {room.members.length - bots}
                    {bots > 0 && ` + ${t('room.bots', { count: bots })}`}
                  </td>
                  <td>{t(room.visibility === 'private' ? 'create.private' : 'create.public')}</td>
                  <td>{new Date(room.createdAt).toLocaleString(locale)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {rooms.data && (
        <Pagination
          total={rooms.data.total}
          limit={rooms.data.limit}
          offset={rooms.data.offset}
          shown={rooms.data.items.length}
          onChange={(offset) => change({ offset })}
        />
      )}
    </section>
  );
}
