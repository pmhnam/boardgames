import { useT } from '../i18n/useT';
import { useIsConnected } from '../websocket/SocketProvider';

export function ConnectionIndicator() {
  const t = useT();
  const connected = useIsConnected();
  return (
    <span className={connected ? 'status online' : 'status offline'} role="status">
      <span className="status-label">
        {connected ? t('connection.online') : t('connection.reconnecting')}
      </span>
    </span>
  );
}
