export interface AlertTurn {
  gameId: string;
  playerId: string | null;
  number: number;
  mine: boolean;
}

/** Owns browser resources and remembers the last turn, independently of action pending state. */
export class TurnAlerts {
  private lastTurn: string | null = null;
  private notification: Notification | null = null;
  private audio: AudioContext | null = null;
  sound = true;
  notifications = false;

  private closeNotification = () => {
    this.notification?.close();
    this.notification = null;
  };

  private onVisible = () => {
    if (!document.hidden && document.hasFocus()) this.closeNotification();
  };

  private unlockAudio = () => {
    if (!this.sound || !('AudioContext' in window)) return;
    try {
      this.audio ??= new AudioContext();
      if (this.audio.state === 'suspended') void this.audio.resume().catch(() => undefined);
    } catch {
      // Audio is optional; unsupported or blocked audio must not interrupt the game.
    }
  };

  start() {
    document.addEventListener('pointerdown', this.unlockAudio);
    document.addEventListener('keydown', this.unlockAudio);
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('focus', this.onVisible);
  }

  setSound(enabled: boolean) {
    this.sound = enabled;
    if (enabled) this.unlockAudio();
  }

  setNotifications(enabled: boolean) {
    this.notifications = enabled;
    if (!enabled) this.closeNotification();
  }

  update(turn: AlertTurn) {
    if (!turn.mine || turn.playerId === null) {
      this.closeNotification();
      return;
    }
    const key = JSON.stringify([turn.gameId, turn.playerId, turn.number]);
    if (key === this.lastTurn) return;
    this.lastTurn = key;
    this.closeNotification();
    this.playChime();
    if (
      this.notifications &&
      (document.hidden || !document.hasFocus()) &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      try {
        const notification = new Notification('Harmonies — Đến lượt bạn', {
          body: 'Quay lại game để chọn token và xây dựng môi trường sống của bạn.',
          tag: `harmonies-turn-${turn.gameId}`,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
        this.notification = notification;
      } catch {
        // Some browsers expose the API but do not support desktop notifications.
      }
    }
  }

  private playChime() {
    const audio = this.audio;
    if (!this.sound || !audio || audio.state !== 'running') return;
    try {
      for (const [index, frequency] of [660, 880].entries()) {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const start = audio.currentTime + index * 0.18;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(start);
        oscillator.stop(start + 0.26);
      }
    } catch {
      // The browser may suspend audio when the app is in the background.
    }
  }

  dispose() {
    document.removeEventListener('pointerdown', this.unlockAudio);
    document.removeEventListener('keydown', this.unlockAudio);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('focus', this.onVisible);
    this.closeNotification();
    if (this.audio) void this.audio.close().catch(() => undefined);
    this.audio = null;
  }
}
