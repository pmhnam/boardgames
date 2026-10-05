import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { SocketProvider } from '../shared/websocket/SocketProvider';
import { router } from './router';
import { useAuthStore } from '../features/auth/auth.store';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

useAuthStore.subscribe((state, previous) => {
  if (state.session?.user.id !== previous.session?.user.id) queryClient.clear();
});

export function App() {
  const userId = useAuthStore((state) => state.session?.user.id);
  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider key={userId ?? 'signed-out'}>
        <RouterProvider router={router} />
      </SocketProvider>
    </QueryClientProvider>
  );
}
