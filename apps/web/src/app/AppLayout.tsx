import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '../features/auth/auth.store';
import { ConnectionIndicator } from '../shared/components/ConnectionIndicator';

export function AppLayout() {
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">
          Board Game Platform
        </Link>
        {session && (
          <nav>
            <Link to="/history">My matches</Link>
            <ConnectionIndicator />
            <span className="muted">{session.user.displayName}</span>
            <button type="button" className="link" onClick={signOut}>
              Sign out
            </button>
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
