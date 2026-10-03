import { useIsConnected } from '../websocket/SocketProvider';

export function ConnectionIndicator() {
  const connected = useIsConnected();
  return (
    <span className={connected ? 'status online' : 'status offline'}>
      {connected ? 'Online' : 'Reconnecting…'}
    </span>
  );
}
