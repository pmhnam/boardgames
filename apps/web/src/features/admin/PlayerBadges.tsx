import type { AdminUserDto } from '@bgp/shared-types';
import { useT } from '../../shared/i18n/useT';

/** What kind of account this is, and whether it is locked out. */
export function PlayerBadges({ user }: { user: AdminUserDto }) {
  const t = useT();
  return (
    <span className="row">
      <span className={user.role === 'admin' ? 'badge success' : 'badge'}>
        {user.role === 'admin'
          ? t('admin.player.admin')
          : user.isBot
            ? t('admin.player.bot')
            : t('admin.match.person')}
      </span>
      {user.disabledAt !== null && (
        <span className="badge warning">{t('admin.player.disabled')}</span>
      )}
    </span>
  );
}
