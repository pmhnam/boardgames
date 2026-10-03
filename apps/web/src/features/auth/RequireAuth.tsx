import { Outlet } from 'react-router-dom';
import { useAuthStore } from './auth.store';
import { GuestLoginForm } from './GuestLoginForm';

/** Renders the guest sign-in in place, so invite links survive signing in. */
export function RequireAuth() {
  const session = useAuthStore((state) => state.session);
  return session ? <Outlet /> : <GuestLoginForm />;
}
