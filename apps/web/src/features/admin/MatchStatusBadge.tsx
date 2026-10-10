import type { MatchStatus } from '@bgp/shared-types';
import { useT } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';

export const MATCH_STATUS_KEYS: Record<MatchStatus, MessageKey> = {
  playing: 'admin.match.status.playing',
  finished: 'admin.match.status.finished',
  abandoned: 'admin.match.status.abandoned',
};

const TONE: Record<MatchStatus, string> = {
  playing: 'badge success',
  finished: 'badge',
  abandoned: 'badge warning',
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const t = useT();
  return <span className={TONE[status]}>{t(MATCH_STATUS_KEYS[status])}</span>;
}
