import type {
  AdminGameConfigDto,
  AdminGameDto,
  ConfigReplayImpactDto,
  GameConfigDocumentDto,
  PublishGameConfigRequest,
} from '@bgp/shared-types';
import { ErrorCodes } from '@bgp/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useImperativeHandle, useState, type Ref } from 'react';
import { ApiRequestError, api } from '../../shared/api/http';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';
import { ConfirmDialog } from './ConfirmDialog';
import { formatDraft, parseDraft, publishBlocker, reformat } from './config-editor';

/** Tall enough to show a small config whole, without a large one taking over the page. */
function editorRows(text: string): number {
  return Math.min(30, Math.max(8, text.split('\n').length + 1));
}

export interface ConfigEditorHandle {
  /** Puts another version's document in the editor. Nothing is published by this. */
  load(config: unknown, version: number): void;
}

interface Props {
  game: AdminGameDto;
  /** The version in force, which the draft starts from and is published on top of. */
  current: AdminGameConfigDto;
  ref?: Ref<ConfigEditorHandle>;
}

export function ConfigEditor({ game, current, ref }: Props) {
  const t = useT();
  const queryClient = useQueryClient();
  const basePath = `/admin/games/${game.gameType}`;
  const [text, setText] = useState(() => formatDraft(current.config));
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const edit = (next: string, message: string | null = null) => {
    setText(next);
    setNotice(message);
    validate.reset();
    publish.reset();
  };

  useImperativeHandle(ref, () => ({
    load: (config, version) => edit(formatDraft(config), t('admin.config.loaded', { version })),
  }));

  const parsed = parseDraft(text);
  const blocker = publishBlocker(text, current.config);

  const validate = useMutation({
    mutationFn: (config: unknown) =>
      api<GameConfigDocumentDto>('POST', `${basePath}/configs/validate`, { config }),
  });

  const loadDefault = useMutation({
    mutationFn: () => api<GameConfigDocumentDto>('GET', `${basePath}/config-default`),
    onSuccess: ({ config }) => edit(formatDraft(config), t('admin.config.loadedDefault')),
  });

  // Asked only once the dialog is open, so the number is as fresh as the decision.
  const impact = useQuery({
    queryKey: ['admin', 'replay-impact', game.gameType, current.version],
    queryFn: () => api<ConfigReplayImpactDto>('GET', `${basePath}/replay-impact`),
    enabled: confirming,
    staleTime: 0,
  });

  const refreshGame = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'games'] });
    void queryClient.invalidateQueries({ queryKey: ['admin', 'configs', game.gameType] });
    // What players' room settings are checked against.
    void queryClient.invalidateQueries({ queryKey: ['game-config', game.gameType] });
  };

  const publish = useMutation({
    mutationFn: (body: PublishGameConfigRequest) =>
      api<AdminGameConfigDto>('POST', `${basePath}/configs`, body),
    // The page then shows the new version, and this editor is replaced by one that starts from it.
    onSuccess: refreshGame,
    onSettled: () => setConfirming(false),
  });

  const conflict =
    publish.error instanceof ApiRequestError &&
    publish.error.code === ErrorCodes.GameConfigConflict;

  return (
    <section className="card" aria-labelledby="admin-config-title">
      <div className="admin-head">
        <h2 id="admin-config-title">{t('admin.config.title', { game: game.displayName })}</h2>
        <span className="badge success">
          {t('admin.config.inForce', { version: current.version })}
        </span>
      </div>
      <p className="muted admin-lead">{t('admin.config.lead', { version: current.version })}</p>
      {current.engineError !== null && (
        <p className="error" role="alert">
          {t('admin.config.engineError', { message: current.engineError })}
        </p>
      )}

      <label htmlFor="admin-config-document">{t('admin.config.document')}</label>
      <textarea
        id="admin-config-document"
        className="admin-code"
        value={text}
        rows={editorRows(text)}
        spellCheck={false}
        aria-invalid={!parsed.ok}
        aria-describedby="admin-config-status"
        onChange={(event) => edit(event.target.value)}
      />

      <div id="admin-config-status" className="admin-status" aria-live="polite">
        {!parsed.ok ? (
          <span className="error">
            {t('admin.config.invalidJson', { message: parsed.message })}
          </span>
        ) : validate.isError ? (
          <span className="error">{errorText(t, validate.error)}</span>
        ) : validate.isSuccess ? (
          <span className="admin-ok">{t('admin.config.valid')}</span>
        ) : blocker === 'unchanged' ? (
          <span className="muted">{t('admin.config.unchanged')}</span>
        ) : (
          <span className="muted">{notice ?? t('admin.config.changed')}</span>
        )}
      </div>

      <div className="row wrap">
        <button
          type="button"
          className="secondary"
          disabled={!parsed.ok}
          onClick={() => edit(reformat(text), notice)}
        >
          {t('admin.config.format')}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!parsed.ok || validate.isPending}
          onClick={() => parsed.ok && validate.mutate(parsed.value)}
        >
          {validate.isPending ? t('admin.config.validating') : t('admin.config.validate')}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={loadDefault.isPending}
          onClick={() => loadDefault.mutate()}
        >
          {t('admin.config.loadDefault')}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={blocker === 'unchanged'}
          onClick={() => edit(formatDraft(current.config))}
        >
          {t('admin.config.discard')}
        </button>
      </div>
      {loadDefault.isError && (
        <p className="error" role="alert">
          {errorText(t, loadDefault.error)}
        </p>
      )}

      <label htmlFor="admin-config-note">{t('admin.config.note')}</label>
      <input
        id="admin-config-note"
        value={note}
        maxLength={500}
        placeholder={t('admin.config.notePlaceholder')}
        onChange={(event) => setNote(event.target.value)}
      />

      <div className="row wrap">
        <button type="button" disabled={blocker !== null} onClick={() => setConfirming(true)}>
          {t('admin.config.publish', { version: current.version + 1 })}
        </button>
      </div>
      {publish.isError && (
        <div className="lobby-notice" role="alert">
          <span className="error">{errorText(t, publish.error)}</span>
          {conflict && (
            // The draft is kept until they ask: it may be worth copying before it goes.
            <button type="button" className="secondary" onClick={refreshGame}>
              {t('admin.config.loadLatest')}
            </button>
          )}
        </div>
      )}

      {confirming && parsed.ok && (
        <ConfirmDialog
          title={t('admin.config.confirmTitle', { version: current.version + 1 })}
          confirmLabel={t('admin.config.confirm')}
          pendingLabel={t('admin.config.publishing')}
          pending={publish.isPending}
          error={null}
          onConfirm={() =>
            publish.mutate({
              config: parsed.value,
              note: note.trim() || undefined,
              expectedVersion: current.version,
            })
          }
          onClose={() => setConfirming(false)}
        >
          <p>{t('admin.config.confirmBody', { game: game.displayName })}</p>
          <p className={impact.data?.replayableMatches ? 'admin-warning' : 'muted'}>
            {impact.data === undefined
              ? t('admin.config.impactUnknown')
              : impact.data.replayableMatches === 0
                ? t('admin.config.impactNone')
                : t('admin.config.impact', { count: impact.data.replayableMatches })}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
