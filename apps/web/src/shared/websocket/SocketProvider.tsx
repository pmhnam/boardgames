import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../../features/auth/auth.store';

const SocketContext = createContext<Socket | null>(null);

/**
 * One authenticated connection per signed-in user. Socket.IO reconnects by itself; features
 * re-sync on every `connect` event rather than replaying what they missed.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const token = useAuthStore((state) => state.session?.accessToken);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const connection = io({ auth: { token }, transports: ['websocket'] });
    setSocket(connection);
    return () => {
      connection.disconnect();
      setSocket(null);
    };
  }, [token]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

/** Null until signed in. */
export function useSocket(): Socket | null {
  return useContext(SocketContext);
}

export function useIsConnected(): boolean {
  const socket = useSocket();
  const [connected, setConnected] = useState(socket?.connected ?? false);

  useEffect(() => {
    if (!socket) {
      setConnected(false);
      return;
    }
    const update = () => setConnected(socket.connected);
    update();
    socket.on('connect', update);
    socket.on('disconnect', update);
    return () => {
      socket.off('connect', update);
      socket.off('disconnect', update);
    };
  }, [socket]);

  return connected;
}
