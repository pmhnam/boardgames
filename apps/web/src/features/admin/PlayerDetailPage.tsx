import type { AdminUserDetailDto, AdminUserDto, SetUserDisabledRequest } from '@bgp/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useLocale, useT } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';
import { useAuthStore } from '../auth/auth.store';
import { RetryNotice } from '../lobby/RetryNotice';
import { playerActions, type DisableBlocker } from './admin-actions';
import { adminGamesQuery } from './ConfigsPage';
import { ConfirmDialog } from './ConfirmDialog';
import { MatchStatusBadge } from './MatchStatusBadge';
import { PlayerBadges } from './PlayerBadges';
import { RoomStatusBadge } from './RoomStatusBadge';

const BLOCKER_KEYS: Record<Exclude<DisableBlocker, null>, MessageKey> = {
  self: 'admin.player.blocker.self',
  admin: 'admin.player.blocker.admin',
  bot: 'admin.player.blocker.bot',
};

export function PlayerDetailPage() {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { userId = '' } = useParams();
  const selfId = useAuthStore((state) => state.session?.user.id);
  const [confirming, setConfirming] = useState(false);

  const games = useQuery(adminGamesQuery);
  const gameName = (type: string) =>
    games.data?.find((game) => game.gameType === type)?.displayName ?? type;
  const detail = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => api<AdminUserDetailDto>('GET', `/admin/users/${userId}`),
  });

  const setDisabled = useMutation({
    mutationFn: (disabled: boolean) =>
      api<AdminUserDto>('PUT', `/admin/users/${userId}/disabled`, {
        disabled,
      } satisfies SetUserDisabledRequest),
    onSuccess: (user) => {
      queryClient.setQueryData<AdminUserDetailDto>(['admin', 'user', userId], (current) =>
        current ? { ...current, user } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setConfirming(false);
    },
  });

  const back = <Link to="/admin/players">{t('admin.player.back')}</Link>;
  if (detail.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (detail.isError || !detail.data) {
    return (
      <div className="stack">
        {back}
        <RetryNotice error={detail.error} onRetry={() => void detail.refetch()} />
      </div>
    );
  }

  const { user, rooms, recentMatches } = detail.data;
  const actions = playerActions(user, selfId);

  return (
    <div className="stack">
      {back}
      <section className="card" aria-labelledby="admin-player-title">
        <div className="admin-head">
          <h2 id="admin-player-title">{user.displayName}</h2>
          <PlayerBadges user={user} />
        </div>
        <dl className="admin-facts">
          <dt>{t('admin.player.joined')}</dt>
          <dd>{new Date(user.createdAt).toLocaleString(locale)}</dd>
          {user.disabledAt !== null && (
            <>
              <dt>{t('admin.player.disabledAt')}</dt>
              <dd>{new Date(user.disabledAt).toLocaleString(locale)}</dd>
            </>
          )}
          <dt>{t('admin.player.id')}</dt>
          <dd className="admin-id">{user.id}</dd>
        </dl>

        <div className="admin-actions">
          {actions.blocker !== null ? (
            <p className="muted admin-lead">{t(BLOCKER_KEYS[actions.blocker])}</p>
          ) : actions.canEnable ? (
            <>
              <p className="muted admin-lead">{t('admin.player.enableHint')}</p>
              <button
                type="button"
                disabled={setDisabled.isPending}
                onClick={() => setDisabled.mutate(false)}
              >
                {t('admin.player.enable')}
              </button>
            </>
          ) : (
            <>
              <p className="muted admin-lead">{t('admin.player.disableHint')}</p>
              <button
                type="button"
                className="admin-danger"
                onClick={() => {
                  setDisabled.reset();
                  setConfirming(true);
                }}
              >
                {t('admin.player.disable')}
              </button>
            </>
          )}
        </div>
        {setDisabled.isError && !confirming && (
          <p className="error" role="alert">
            {errorText(t, setDisabled.error)}
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="admin-player-rooms">
        <h2 id="admin-player-rooms">{t('admin.player.rooms')}</h2>
        {rooms.length === 0 ? (
          <p className="muted admin-lead">{t('admin.player.noRooms')}</p>
        ) : (
          <table>
            <tbody>
              {rooms.map((room) => (
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
                  <td>{new Date(room.createdAt).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" aria-labelledby="admin-player-matches">
        <h2 id="admin-player-matches">{t('admin.player.matches')}</h2>
        {recentMatches.length === 0 ? (
          <p className="muted admin-lead">{t('admin.player.noMatches')}</p>
        ) : (
          <table>
            <tbody>
              {recentMatches.map((match) => (
                <tr key={match.id}>
                  <th scope="row">
                    <Link to={`/admin/matches/${match.id}`}>{gameName(match.gameType)}</Link>
                  </th>
                  <td>
                    <MatchStatusBadge status={match.status} />
                  </td>
                  <td>{match.players.map((player) => player.displayName).join(', ')}</td>
                  <td>{new Date(match.createdAt).toLocaleString(locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {confirming && (
        <ConfirmDialog
          title={t('admin.player.disableTitle', { name: user.displayName })}
          confirmLabel={t('admin.player.disableConfirm')}
          pendingLabel={t('admin.player.disabling')}
          pending={setDisabled.isPending}
          error={setDisabled.error}
          danger
          onConfirm={() => setDisabled.mutate(true)}
          onClose={() => setConfirming(false)}
        >
          <p>{t('admin.player.disableBody')}</p>
          <p className="muted">{t('admin.player.disableCaveat')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
