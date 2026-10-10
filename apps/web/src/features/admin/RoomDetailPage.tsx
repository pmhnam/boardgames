import type { AdminRoomDto, RoomMemberDto } from '@bgp/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { useLocale, useT } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';
import { RetryNotice } from '../lobby/RetryNotice';
import { roomActions } from './admin-actions';
import { adminGamesQuery } from './ConfigsPage';
import { ConfirmDialog } from './ConfirmDialog';
import { RoomStatusBadge } from './RoomStatusBadge';

const BOT_LEVEL_KEYS: Record<string, MessageKey> = {
  easy: 'botLevel.easy',
  normal: 'botLevel.normal',
  hard: 'botLevel.hard',
};

export function RoomDetailPage() {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { roomId = '' } = useParams();
  const [closing, setClosing] = useState(false);
  const [removing, setRemoving] = useState<RoomMemberDto | null>(null);

  const games = useQuery(adminGamesQuery);
  const room = useQuery({
    queryKey: ['admin', 'room', roomId],
    queryFn: () => api<AdminRoomDto>('GET', `/admin/rooms/${roomId}`),
    refetchInterval: (query) => (query.state.data?.status === 'closed' ? false : 5_000),
  });

  const updated = (next: AdminRoomDto) => {
    queryClient.setQueryData(['admin', 'room', roomId], next);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
    setClosing(false);
    setRemoving(null);
  };
  const close = useMutation({
    mutationFn: () => api<AdminRoomDto>('POST', `/admin/rooms/${roomId}/close`),
    onSuccess: updated,
  });
  const remove = useMutation({
    mutationFn: (userId: string) =>
      api<AdminRoomDto>('DELETE', `/admin/rooms/${roomId}/members/${userId}`),
    onSuccess: updated,
  });

  const back = <Link to="/admin/rooms">{t('admin.room.back')}</Link>;
  if (room.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (room.isError || !room.data) {
    return (
      <div className="stack">
        {back}
        <RetryNotice error={room.error} onRetry={() => void room.refetch()} />
      </div>
    );
  }

  const data = room.data;
  const actions = roomActions(data);
  const gameName =
    games.data?.find((game) => game.gameType === data.gameType)?.displayName ?? data.gameType;

  return (
    <div className="stack">
      {back}
      <section className="card" aria-labelledby="admin-room-title">
        <div className="admin-head">
          <h2 id="admin-room-title">{t('roomPage.title', { code: data.code })}</h2>
          <RoomStatusBadge status={data.status} />
        </div>
        <dl className="admin-facts">
          <dt>{t('admin.filter.game')}</dt>
          <dd>{gameName}</dd>
          <dt>{t('admin.room.host')}</dt>
          <dd>
            <Link to={`/admin/players/${data.hostUserId}`}>{data.hostDisplayName}</Link>
          </dd>
          <dt>{t('admin.room.visibility')}</dt>
          <dd>{t(data.visibility === 'private' ? 'create.private' : 'create.public')}</dd>
          <dt>{t('admin.room.created')}</dt>
          <dd>{new Date(data.createdAt).toLocaleString(locale)}</dd>
          {data.currentMatchId && (
            <>
              <dt>{t('admin.room.match')}</dt>
              <dd>
                <Link to={`/admin/matches/${data.currentMatchId}`}>
                  {t('admin.room.openMatch')}
                </Link>
              </dd>
            </>
          )}
        </dl>

        <h3>{t('admin.room.members')}</h3>
        {data.members.length === 0 ? (
          <p className="muted admin-lead">{t('admin.room.noMembers')}</p>
        ) : (
          <table>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.userId}>
                  <th scope="row">
                    <Link to={`/admin/players/${member.userId}`}>{member.displayName}</Link>
                  </th>
                  <td>
                    {member.botLevel
                      ? t('roomPage.computer', { level: t(BOT_LEVEL_KEYS[member.botLevel]!) })
                      : member.userId === data.hostUserId
                        ? t('roomPage.host')
                        : t('admin.match.person')}
                  </td>
                  <td>{t('admin.match.seat', { seat: member.seat + 1 })}</td>
                  <td>
                    {actions.canRemoveMembers && (
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          remove.reset();
                          setRemoving(member);
                        }}
                      >
                        {t('admin.room.remove')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {actions.blockedByMatch && (
          <p className="admin-warning admin-lead">{t('admin.room.blockedByMatch')}</p>
        )}
        {actions.canClose && (
          <div className="admin-actions">
            <p className="muted admin-lead">{t('admin.room.closeHint')}</p>
            <button
              type="button"
              className="admin-danger"
              onClick={() => {
                close.reset();
                setClosing(true);
              }}
            >
              {t('admin.room.close')}
            </button>
          </div>
        )}
      </section>

      {closing && (
        <ConfirmDialog
          title={t('admin.room.closeTitle', { code: data.code })}
          confirmLabel={t('admin.room.closeConfirm')}
          pendingLabel={t('admin.room.closing')}
          pending={close.isPending}
          error={close.error}
          danger
          onConfirm={() => close.mutate()}
          onClose={() => setClosing(false)}
        >
          <p>{t('admin.room.closeBody', { count: data.members.length })}</p>
        </ConfirmDialog>
      )}
      {removing && (
        <ConfirmDialog
          title={t('admin.room.removeTitle', { name: removing.displayName })}
          confirmLabel={t('admin.room.remove')}
          pendingLabel={t('admin.room.removing')}
          pending={remove.isPending}
          error={remove.error}
          danger
          onConfirm={() => remove.mutate(removing.userId)}
          onClose={() => setRemoving(null)}
        >
          <p>
            {t(
              removing.userId === data.hostUserId
                ? 'admin.room.removeHostBody'
                : 'admin.room.removeBody',
            )}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}
