import { Link, NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { AccountMenu } from '../shared/components/AccountMenu';
import { HeaderControlsTarget } from '../shared/components/HeaderControls';
import { useAuthStore } from '../features/auth/auth.store';
import { isAdmin } from '../features/auth/roles';
import { ConnectionIndicator } from '../shared/components/ConnectionIndicator';
import { LanguageSwitcher } from '../shared/i18n/LanguageSwitcher';
import { useT } from '../shared/i18n/useT';
import { VoiceBar, VoiceJoinButton } from '../shared/voice/VoiceBar';
import { VoiceProvider } from '../shared/voice/VoiceProvider';
import { useConnectionLost } from '../shared/websocket/SocketProvider';

export function AppLayout() {
  const t = useT();
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const connectionLost = useConnectionLost();
  const [controlsTarget, setControlsTarget] = useState<HTMLDivElement | null>(null);

  // Listed in the header where there is room, and in the account menu where there is not.
  const links = session && (
    <>
      <NavLink to="/history">{t('nav.history')}</NavLink>
      {isAdmin(session) && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
    </>
  );

  return (
    <HeaderControlsTarget.Provider value={controlsTarget}>
      <VoiceProvider>
        <div className="app">
          <header className="app-header">
            <Link to="/" className="brand">
              {t('app.name')}
            </Link>
            <div className="app-header-tools">
              <div className="app-game-controls" ref={setControlsTarget} />
              {session ? (
                <>
                  <VoiceJoinButton />
                  <nav className="app-header-links" aria-label={t('nav.label')}>
                    {links}
                  </nav>
                  <ConnectionIndicator />
                  <AccountMenu name={session.user.displayName} links={links} onSignOut={signOut} />
                </>
              ) : (
                <LanguageSwitcher />
              )}
            </div>
          </header>
          {/* No live role: the indicator in the header has already announced it. */}
          {connectionLost && <p className="connection-bar">{t('connection.lost')}</p>}
          <VoiceBar />
          <main>
            <Outlet />
          </main>
        </div>
      </VoiceProvider>
    </HeaderControlsTarget.Provider>
  );
}
