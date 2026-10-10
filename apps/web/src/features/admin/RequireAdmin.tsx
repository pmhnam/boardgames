import type { UserDto } from '@bgp/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { ApiRequestError, api } from '../../shared/api/http';
import { useT } from '../../shared/i18n/useT';
import { useAuthStore } from '../auth/auth.store';
import { isAdmin } from '../auth/roles';

/**
 * Keeps the admin pages for administrators. The stored role only decides what to draw; the
 * server refuses every admin request from anyone else, and is asked here so a session whose
 * role has changed finds out straight away.
 */
export function RequireAdmin() {
  const t = useT();
  const session = useAuthStore((state) => state.session);
  const setSession = useAuthStore((state) => state.setSession);
  const admin = isAdmin(session);

  const current = useQuery({
    queryKey: ['admin', 'session', session?.user.id],
    queryFn: () => api<UserDto>('GET', '/admin/session'),
    enabled: admin,
  });

  const refused = current.error instanceof ApiRequestError && current.error.status === 403;
  useEffect(() => {
    if (!session || !refused) return;
    setSession({ ...session, user: { ...session.user, role: 'player' } });
  }, [session, refused, setSession]);

  if (!session) return <Navigate to="/admin/login" replace />;
  if (!admin) {
    return (
      <div className="card narrow">
        <p className="login-intro">{t('admin.notAdmin', { name: session.user.displayName })}</p>
        <Link to="/admin/login">{t('admin.signInAsAdmin')}</Link>
      </div>
    );
  }
  return <Outlet />;
}
