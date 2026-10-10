import type { AuthSessionDto } from '@bgp/shared-types';

/**
 * Whether to show this session the admin area. Only a convenience: the server checks every
 * admin request itself. Sessions stored before roles existed have none, and are players.
 */
export function isAdmin(session: AuthSessionDto | null | undefined): boolean {
  return session?.user.role === 'admin';
}
