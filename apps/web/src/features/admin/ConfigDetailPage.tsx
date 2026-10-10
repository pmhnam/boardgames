import type { AdminGameConfigDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../shared/api/http';
import { useT } from '../../shared/i18n/useT';
import { RetryNotice } from '../lobby/RetryNotice';
import { ConfigEditor, type ConfigEditorHandle } from './ConfigEditor';
import { ConfigHistory } from './ConfigHistory';
import { adminGamesQuery } from './ConfigsPage';

export function ConfigDetailPage() {
  const t = useT();
  const { gameType = '' } = useParams();
  const editor = useRef<ConfigEditorHandle>(null);

  const games = useQuery(adminGamesQuery);
  const game = games.data?.find((candidate) => candidate.gameType === gameType);
  const current = useQuery({
    queryKey: ['admin', 'config', gameType, game?.currentVersion],
    queryFn: () =>
      api<AdminGameConfigDto>('GET', `/admin/games/${gameType}/configs/${game?.currentVersion}`),
    enabled: game !== undefined,
  });

  const back = <Link to="/admin/configs">{t('admin.config.back')}</Link>;
  if (games.isError)
    return <RetryNotice error={games.error} onRetry={() => void games.refetch()} />;
  if (current.isError) {
    return <RetryNotice error={current.error} onRetry={() => void current.refetch()} />;
  }
  if (games.isLoading || (game && !current.data)) {
    return <p className="muted">{t('common.loading')}</p>;
  }
  if (!game || !current.data) {
    return (
      <div className="card">
        <p className="error">{t('error.unknownGameType')}</p>
        {back}
      </div>
    );
  }

  return (
    <div className="stack">
      {back}
      {/* Keyed by version: once a new one is in force, the editor starts again from it. */}
      <ConfigEditor key={current.data.version} ref={editor} game={game} current={current.data} />
      <ConfigHistory
        game={game}
        onLoad={(config, version) => editor.current?.load(config, version)}
      />
    </div>
  );
}
