import type { AuthSessionDto } from '@bgp/shared-types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AuthState {
  session: AuthSessionDto | null;
  setSession(session: AuthSessionDto): void;
  signOut(): void;
}

/**
 * Kept in sessionStorage on purpose: each tab is its own guest, so two tabs of one browser can
 * play against each other, and a reload keeps you signed in.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      signOut: () => set({ session: null }),
    }),
    { name: 'bgp-session', storage: createJSONStorage(() => sessionStorage) },
  ),
);
