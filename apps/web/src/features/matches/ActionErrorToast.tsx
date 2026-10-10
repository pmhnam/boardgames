import type { ApiError } from '@bgp/shared-types';
import { useEffect, useState } from 'react';
import { errorText } from '../../shared/i18n/errors';
import { useT } from '../../shared/i18n/useT';

/** Long enough to read a sentence, short enough not to sit over the board. */
const SHOWN_FOR_MS = 5000;

/** Why the last move was refused, said over the board and not above it, so nothing moves. */
export function ActionErrorToast({ error }: { error: ApiError | null }) {
  const t = useT();
  // Each refusal arrives as an object of its own, so the same reason twice is shown twice.
  const [dismissed, setDismissed] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setDismissed(error), SHOWN_FOR_MS);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    // Always there, so that what appears in it is announced.
    <div className="match-toasts" role="alert">
      {error && error !== dismissed && (
        <div className="match-toast">
          <span>{errorText(t, error)}</span>
          <button
            type="button"
            className="link"
            aria-label={t('common.close')}
            onClick={() => setDismissed(error)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
