import type { RoomStatus } from '@bgp/shared-types';
import { useT } from '../../shared/i18n/useT';
import type { MessageKey } from '../../shared/i18n/vi';

export const ROOM_STATUS_KEYS: Record<RoomStatus, MessageKey> = {
  open: 'admin.room.status.open',
  in_match: 'admin.room.status.inMatch',
  closed: 'admin.room.status.closed',
};

const TONE: Record<RoomStatus, string> = {
  open: 'badge success',
  in_match: 'badge warning',
  closed: 'badge',
};

export function RoomStatusBadge({ status }: { status: RoomStatus }) {
  const t = useT();
  return <span className={TONE[status]}>{t(ROOM_STATUS_KEYS[status])}</span>;
}
