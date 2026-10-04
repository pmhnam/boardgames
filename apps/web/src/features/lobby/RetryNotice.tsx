import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';

/** A failed load, said where the thing would have been, with a way to try it again. */
export function RetryNotice({ error, onRetry }: { error: unknown; onRetry(): void }) {
  const t = useT();
  return (
    <div className="lobby-notice" role="alert">
      <span className="error">{errorText(t, error)}</span>
      <button type="button" className="secondary" onClick={onRetry}>
        {t('lobby.retry')}
      </button>
    </div>
  );
}
