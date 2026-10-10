import type {
  AdminGameConfigDto,
  AdminGameDto,
  GameConfigSummaryDto,
  Page,
  RestoreGameConfigRequest,
} from '@bgp/shared-types';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useLocale, useT } from '../../shared/i18n/useT';
import { RetryNotice } from '../lobby/RetryNotice';
import { ConfirmDialog } from '../../shared/components/ConfirmDialog';
import { Pagination } from './Pagination';

const PAGE_SIZE = 10;

interface Props {
  game: AdminGameDto;
  onLoad(config: unknown, version: number): void;
}

/** Every version ever published for a game. Rows are only ever added. */
export function ConfigHistory({ game, onLoad }: Props) {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const basePath = `/admin/games/${game.gameType}/configs`;
  const [offset, setOffset] = useState(0);
  const [restoring, setRestoring] = useState<number | null>(null);

  const history = useQuery({
    queryKey: ['admin', 'configs', game.gameType, offset],
    queryFn: () =>
      api<Page<GameConfigSummaryDto>>('GET', `${basePath}?limit=${PAGE_SIZE}&offset=${offset}`),
    placeholderData: keepPreviousData,
  });

  const load = useMutation({
    mutationFn: (version: number) => api<AdminGameConfigDto>('GET', `${basePath}/${version}`),
    onSuccess: (config) => onLoad(config.config, config.version),
  });

  const restore = useMutation({
    mutationFn: (version: number) =>
      api<AdminGameConfigDto>('POST', `${basePath}/${version}/restore`, {
        expectedVersion: game.currentVersion,
      } satisfies RestoreGameConfigRequest),
    onSuccess: () => {
      setRestoring(null);
      setOffset(0);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'games'] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'configs', game.gameType] });
      void queryClient.invalidateQueries({ queryKey: ['game-config', game.gameType] });
    },
  });

  return (
    <section className="card" aria-labelledby="admin-config-history">
      <h2 id="admin-config-history">{t('admin.config.history')}</h2>
      {history.isError && (
        <RetryNotice error={history.error} onRetry={() => void history.refetch()} />
      )}
      {history.isLoading && <p className="muted">{t('common.loading')}</p>}
      {history.data && (
        <>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('admin.config.version')}</th>
                <th scope="col">{t('admin.configs.publishedAt')}</th>
                <th scope="col">{t('admin.config.author')}</th>
                <th scope="col">{t('admin.config.noteColumn')}</th>
                <th scope="col">
                  <span className="sr-only">{t('admin.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {history.data.items.map((version) => {
                const inForce = version.version === game.currentVersion;
                return (
                  <tr key={version.version}>
                    <th scope="row">
                      v{version.version}{' '}
                      {inForce && (
                        <span className="badge success">{t('admin.config.current')}</span>
                      )}
                    </th>
                    <td>{new Date(version.createdAt).toLocaleString(locale)}</td>
                    <td>{version.createdBy?.displayName ?? t('admin.config.system')}</td>
                    <td className="admin-wrap">{version.note ?? '—'}</td>
                    <td>
                      <span className="row">
                        <button
                          type="button"
                          className="link"
                          disabled={load.isPending}
                          onClick={() => load.mutate(version.version)}
                        >
                          {t('admin.config.load')}
                        </button>
                        {!inForce && (
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              restore.reset();
                              setRestoring(version.version);
                            }}
                          >
                            {t('admin.config.restore')}
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Pagination
            total={history.data.total}
            limit={history.data.limit}
            offset={history.data.offset}
            shown={history.data.items.length}
            onChange={setOffset}
          />
        </>
      )}
      {load.isError && (
        <p className="error" role="alert">
          {errorText(t, load.error)}
        </p>
      )}

      {restoring !== null && (
        <ConfirmDialog
          title={t('admin.config.restoreTitle', { version: restoring })}
          confirmLabel={t('admin.config.restore')}
          pendingLabel={t('admin.config.publishing')}
          pending={restore.isPending}
          error={restore.error}
          onConfirm={() => restore.mutate(restoring)}
          onClose={() => setRestoring(null)}
        >
          <p>
            {t('admin.config.restoreBody', { version: restoring, next: game.currentVersion + 1 })}
          </p>
          <p className="muted">{t('admin.config.restoreImpact')}</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
