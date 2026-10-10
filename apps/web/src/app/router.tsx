import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RequireAuth } from '../features/auth/RequireAuth';
import { LobbyPage } from '../features/lobby/LobbyPage';
import { MatchHistoryPage } from '../features/matches/MatchHistoryPage';
import { MatchPage } from '../features/matches/MatchPage';
import { ReplayPage } from '../features/matches/ReplayPage';
import { JoinByCodePage } from '../features/rooms/JoinByCodePage';
import { RoomPage } from '../features/rooms/RoomPage';
import { AppLayout } from './AppLayout';

// Players never need the admin pages, so they are fetched only when one is opened.
const admin = () => import('../features/admin/pages');

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: '/admin/login',
        lazy: async () => ({ Component: (await admin()).AdminLoginPage }),
      },
      {
        path: '/admin',
        lazy: async () => ({ Component: (await admin()).RequireAdmin }),
        children: [
          {
            lazy: async () => ({ Component: (await admin()).AdminLayout }),
            children: [
              { index: true, element: <Navigate to="/admin/configs" replace /> },
              {
                path: 'configs',
                lazy: async () => ({ Component: (await admin()).ConfigsPage }),
              },
              {
                path: 'configs/:gameType',
                lazy: async () => ({ Component: (await admin()).ConfigDetailPage }),
              },
              {
                path: 'rooms',
                lazy: async () => ({ Component: (await admin()).RoomsPage }),
              },
              {
                path: 'rooms/:roomId',
                lazy: async () => ({ Component: (await admin()).RoomDetailPage }),
              },
              {
                path: 'players',
                lazy: async () => ({ Component: (await admin()).PlayersPage }),
              },
              {
                path: 'players/:userId',
                lazy: async () => ({ Component: (await admin()).PlayerDetailPage }),
              },
              {
                path: 'matches',
                lazy: async () => ({ Component: (await admin()).MatchesPage }),
              },
              {
                path: 'matches/:matchId',
                lazy: async () => ({ Component: (await admin()).MatchDetailPage }),
              },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <LobbyPage /> },
          { path: '/join/:code', element: <JoinByCodePage /> },
          { path: '/rooms/:roomId', element: <RoomPage /> },
          { path: '/matches/:matchId', element: <MatchPage /> },
          { path: '/matches/:matchId/replay', element: <ReplayPage /> },
          { path: '/history', element: <MatchHistoryPage /> },
        ],
      },
    ],
  },
]);
