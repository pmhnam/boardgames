import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { HeaderControlsTarget } from '../shared/components/HeaderControls';
import { useAuthStore } from '../features/auth/auth.store';
import { isAdmin } from '../features/auth/roles';
import { ConnectionIndicator } from '../shared/components/ConnectionIndicator';
import { LanguageSwitcher } from '../shared/i18n/LanguageSwitcher';
import { useT } from '../shared/i18n/useT';
import { useConnectionLost } from '../shared/websocket/SocketProvider';

export function AppLayout() {
  const t = useT();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const connectionLost = useConnectionLost();
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);

  return (
    <HeaderControlsTarget.Provider value={controlsTarget}>
      <div className="app">
        <header className="app-header">
          <Link to="/" className="brand">
            {t('app.name')}
          </Link>
          <div className="app-header-tools">
            <div className="app-game-controls" ref={setControlsTarget} />
            {session && (
              <nav aria-label={t('nav.label')}>
                <NavLink to="/history">{t('nav.history')}</NavLink>
                {isAdmin(session) && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
              </nav>
            )}
            <LanguageSwitcher />
            {session && (
              <>
                <ConnectionIndicator />
                <span className="muted">{session.user.displayName}</span>
                <button type="button" className="link" onClick={signOut}>
                  {t('nav.signOut')}
                </button>
              </>
            )}
          </div>
        </header>
        {/* No live role: the indicator in the header has already announced it. */}
        {connectionLost && <p className="connection-bar">{t('connection.lost')}</p>}
        <main>
          <Outlet />
        </main>
      </div>
    </HeaderControlsTarget.Provider>
  );
}
