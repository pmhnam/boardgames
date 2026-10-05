import type { AuthSessionDto } from '@bgp/shared-types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AuthState {
  session: AuthSessionDto | null;
  setSession(session: AuthSessionDto): void;
  signOut(): void;
}

/** One persistent identity shared by all tabs of this browser. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      signOut: () => set({ session: null }),
    }),
    { name: 'bgp-session', storage: createJSONStorage(() => localStorage) },
  ),
);

window.addEventListener('storage', (event) => {
  if (event.storageArea !== localStorage) return;
  if (event.key === 'bgp-session' || event.key === null) {
    if (event.newValue === null) useAuthStore.getState().signOut();
    else void useAuthStore.persist.rehydrate();
  }
});
