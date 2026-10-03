import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from '../features/auth/RequireAuth';
import { LobbyPage } from '../features/lobby/LobbyPage';
import { MatchHistoryPage } from '../features/matches/MatchHistoryPage';
import { MatchPage } from '../features/matches/MatchPage';
import { ReplayPage } from '../features/matches/ReplayPage';
import { JoinByCodePage } from '../features/rooms/JoinByCodePage';
import { RoomPage } from '../features/rooms/RoomPage';
import { AppLayout } from './AppLayout';

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
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
