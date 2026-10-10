import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../../features/auth/auth.store';

const SocketContext = createContext<Socket | null>(null);

/** A connection down for less than this is not worth telling anyone about. */
const LOST_AFTER_MS = 1500;

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

/** False only when the browser knows it has no network at all. */
function useBrowserOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

/**
 * True once the connection has been down long enough to say so. Opening the page and the blips
 * Socket.IO recovers from by itself stay unsaid.
 */
export function useConnectionLost(): boolean {
  const socket = useSocket();
  const connected = useIsConnected();
  // The socket itself only notices a dead link when a heartbeat goes unanswered, half a minute on.
  const online = useBrowserOnline();
  const down = socket !== null && (!connected || !online);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    if (!down) {
      setLost(false);
      return;
    }
    const timer = setTimeout(() => setLost(true), LOST_AFTER_MS);
    return () => clearTimeout(timer);
  }, [down]);

  return lost;
}
