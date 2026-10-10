import type { AdminMatchDto } from '@bgp/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { playerName } from '../../games/types';
import { api } from '../../shared/api/http';
import { useLocale, useT, type Translate } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';
import { RetryNotice } from '../lobby/RetryNotice';
import { matchActions } from './admin-actions';
import { adminGamesQuery } from './ConfigsPage';
import { ConfirmDialog } from './ConfirmDialog';
import { MatchStatusBadge } from './MatchStatusBadge';

const BOT_LEVEL_KEYS: Record<string, MessageKey> = {
  easy: 'botLevel.easy',
  normal: 'botLevel.normal',
  hard: 'botLevel.hard',
};

function seatKind(t: Translate, player: AdminMatchDto['players'][number]): string {
  if (player.botLevel) {
    return t('roomPage.computer', { level: t(BOT_LEVEL_KEYS[player.botLevel]!) });
  }
  return player.autoplayLevel ? t('admin.match.autoplay') : t('admin.match.person');
}

export function MatchDetailPage() {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { matchId = '' } = useParams();
  const [confirming, setConfirming] = useState(false);

  const games = useQuery(adminGamesQuery);
  const match = useQuery({
    queryKey: ['admin', 'match', matchId],
    queryFn: () => api<AdminMatchDto>('GET', `/admin/matches/${matchId}`),
    // A match being played moves on by itself.
    refetchInterval: (query) => (query.state.data?.status === 'playing' ? 5_000 : false),
  });

  const abandon = useMutation({
    mutationFn: () => api<AdminMatchDto>('POST', `/admin/matches/${matchId}/abandon`),
    onSuccess: (ended) => {
      queryClient.setQueryData(['admin', 'match', matchId], ended);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'matches'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rooms'] });
      setConfirming(false);
    },
  });

  const back = <Link to="/admin/matches">{t('admin.match.back')}</Link>;
  if (match.isLoading) return <p className="muted">{t('common.loading')}</p>;
  if (match.isError || !match.data) {
    return (
      <div className="stack">
        {back}
        <RetryNotice error={match.error} onRetry={() => void match.refetch()} />
      </div>
    );
  }

  const data = match.data;
  const actions = matchActions(data);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale) : '—');
  const gameName =
    games.data?.find((game) => game.gameType === data.gameType)?.displayName ?? data.gameType;
  const winners = (data.result?.winnerPlayerIds ?? []).map((id) => playerName(data.players, id));

  return (
    <div className="stack">
      {back}
      <section className="card" aria-labelledby="admin-match-title">
        <div className="admin-head">
          <h2 id="admin-match-title">{t('admin.match.title', { game: gameName })}</h2>
          <MatchStatusBadge status={data.status} />
        </div>
        {data.engineOutdated && data.status === 'playing' && (
          <p className="admin-warning">{t('admin.match.outdatedHint')}</p>
        )}
        <dl className="admin-facts">
          <dt>{t('admin.match.room')}</dt>
          <dd>
            <Link to={`/admin/rooms/${data.roomId}`}>{data.roomCode}</Link>
          </dd>
          <dt>{t('admin.match.started')}</dt>
          <dd>{when(data.startedAt ?? data.createdAt)}</dd>
          <dt>{t('admin.match.lastMove')}</dt>
          <dd>{data.lastActionAt ? when(data.lastActionAt) : t('admin.match.noMoves')}</dd>
          <dt>{t('admin.match.moves')}</dt>
          <dd>{data.version}</dd>
          <dt>{t('admin.match.ended')}</dt>
          <dd>{when(data.finishedAt)}</dd>
          {data.status === 'finished' && (
            <>
              <dt>{t('admin.match.winners')}</dt>
              <dd>{winners.length > 0 ? winners.join(' & ') : '—'}</dd>
            </>
          )}
          <dt>{t('admin.match.rules')}</dt>
          <dd>
            v{data.engineVersion} · {t('admin.match.config', { version: data.configVersion })}
          </dd>
          <dt>{t('admin.match.id')}</dt>
          <dd className="admin-id">{data.id}</dd>
        </dl>

        <h3>{t('admin.match.players')}</h3>
        <table>
          <tbody>
            {data.players.map((player) => (
              <tr key={player.playerId}>
                <th scope="row">
                  <Link to={`/admin/players/${player.userId}`}>{player.displayName}</Link>
                </th>
                <td>{t('admin.match.seat', { seat: player.seat + 1 })}</td>
                <td>{seatKind(t, player)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {actions.canAbandon && (
          <div className="admin-actions">
            <p className="muted admin-lead">{t('admin.match.abandonHint')}</p>
            <button
              type="button"
              className="admin-danger"
              onClick={() => {
                abandon.reset();
                setConfirming(true);
              }}
            >
              {t('admin.match.abandon')}
            </button>
          </div>
        )}
      </section>

      {confirming && (
        <ConfirmDialog
          title={t('admin.match.abandonTitle')}
          confirmLabel={t('admin.match.abandonConfirm')}
          pendingLabel={t('admin.match.abandoning')}
          pending={abandon.isPending}
          error={abandon.error}
          danger
          onConfirm={() => abandon.mutate()}
          onClose={() => setConfirming(false)}
        >
          <p>{t('admin.match.abandonBody')}</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
