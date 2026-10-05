import { useEffect, useRef, useState } from 'react';
import { TurnAlerts, type AlertTurn } from './turnAlerts';

const SOUND_KEY = 'harmonies.turn-sound';
const NOTIFICATIONS_KEY = 'harmonies.turn-notifications';

function readPreference(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

function savePreference(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Preferences still work for this session when storage is unavailable.
  }
}

export function useTurnAlerts(turn: AlertTurn) {
  const alerts = useRef<TurnAlerts | null>(null);
  const [sound, setSound] = useState(() => readPreference(SOUND_KEY, true));
  const [notifications, setNotifications] = useState(() =>
    readPreference(NOTIFICATIONS_KEY, false),
  );
  const supported = 'Notification' in window && window.isSecureContext;
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported ? Notification.permission : 'default',
  );
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new TurnAlerts();
    alerts.current = controller;
    controller.start();
    return () => {
      controller.dispose();
      alerts.current = null;
    };
  }, []);

  useEffect(() => {
    if (alerts.current) alerts.current.sound = sound;
  }, [sound]);

  useEffect(() => {
    alerts.current?.setNotifications(notifications && permission === 'granted');
  }, [notifications, permission]);

  useEffect(() => {
    alerts.current?.update(turn);
  }, [turn.gameId, turn.playerId, turn.number, turn.mine]);

  useEffect(() => {
    if (!supported) return;
    const refresh = () => setPermission(Notification.permission);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [supported]);

  const toggleSound = () => {
    const enabled = !sound;
    alerts.current?.setSound(enabled);
    setSound(enabled);
    savePreference(SOUND_KEY, enabled);
  };

  const toggleNotifications = async () => {
    if (!supported || requesting) return;
    setError('');
    if (notifications && permission === 'granted') {
      alerts.current?.setNotifications(false);
      setNotifications(false);
      savePreference(NOTIFICATIONS_KEY, false);
      return;
    }
    setRequesting(true);
    try {
      const result = await Notification.requestPermission();
      const enabled = result === 'granted';
      setPermission(result);
      setNotifications(enabled);
      savePreference(NOTIFICATIONS_KEY, enabled);
      alerts.current?.setNotifications(enabled);
    } catch {
      setError('Không thể bật thông báo trên trình duyệt này.');
    } finally {
      setRequesting(false);
    }
  };

  return {
    sound,
    notifications,
    supported,
    permission,
    requesting,
    error,
    toggleSound,
    toggleNotifications,
  };
}
