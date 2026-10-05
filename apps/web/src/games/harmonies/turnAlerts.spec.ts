import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TurnAlerts, type AlertTurn } from './turnAlerts';

describe('Harmonies turn alerts', () => {
  let alerts: TurnAlerts;
  let page: EventTarget & { hidden: boolean; hasFocus: () => boolean };
  let browser: EventTarget & { focus: ReturnType<typeof vi.fn> };
  const notices: FakeNotification[] = [];
  const tones: Array<{ start: ReturnType<typeof vi.fn> }> = [];
  const audioClosed = vi.fn(() => Promise.resolve());
  let focused = false;

  class FakeNotification {
    static permission = 'granted';
    close = vi.fn();
    onclick: (() => void) | null = null;
    constructor(
      public title: string,
      public options: NotificationOptions,
    ) {
      notices.push(this);
    }
  }

  class FakeAudio {
    state = 'running';
    currentTime = 0;
    destination = {};
    close = audioClosed;
    createOscillator() {
      const tone = {
        frequency: { value: 0 },
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      };
      tones.push(tone);
      return tone;
    }
    createGain() {
      return {
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
    }
  }

  const turn = (number = 1, mine = true): AlertTurn => ({
    gameId: 'match-1',
    playerId: 'me',
    number,
    mine,
  });

  beforeEach(() => {
    notices.length = 0;
    tones.length = 0;
    audioClosed.mockClear();
    FakeNotification.permission = 'granted';
    focused = false;
    page = Object.assign(new EventTarget(), { hidden: true, hasFocus: () => focused });
    browser = Object.assign(new EventTarget(), {
      Notification: FakeNotification,
      AudioContext: FakeAudio,
      focus: vi.fn(),
    });
    vi.stubGlobal('document', page);
    vi.stubGlobal('window', browser);
    vi.stubGlobal('Notification', FakeNotification);
    vi.stubGlobal('AudioContext', FakeAudio);
    alerts = new TurnAlerts();
    alerts.start();
    alerts.setNotifications(true);
  });

  afterEach(() => {
    alerts.dispose();
    vi.unstubAllGlobals();
  });

  it('alerts once per turn despite repeated syncs and updates within the turn', () => {
    page.dispatchEvent(new Event('pointerdown'));
    alerts.update(turn());
    alerts.update(turn());
    alerts.update(turn());
    expect(notices).toHaveLength(1);
    expect(tones).toHaveLength(2);
    alerts.update(turn(2, false));
    expect(notices[0]!.close).toHaveBeenCalledOnce();
    alerts.update(turn(3));
    expect(notices).toHaveLength(2);
    expect(tones).toHaveLength(4);
  });

  it('sounds in the active tab but only notifies in the background or without focus', () => {
    page.hidden = false;
    focused = true;
    page.dispatchEvent(new Event('keydown'));
    alerts.update(turn());
    expect(tones).toHaveLength(2);
    expect(notices).toHaveLength(0);
    focused = false;
    alerts.update(turn(2));
    expect(notices).toHaveLength(1);
    focused = true;
    browser.dispatchEvent(new Event('focus'));
    expect(notices[0]!.close).toHaveBeenCalledOnce();
  });

  it('never alerts spectators or inactive/finished turns', () => {
    page.dispatchEvent(new Event('pointerdown'));
    alerts.update({ ...turn(), playerId: null });
    alerts.update(turn(2, false));
    expect(tones).toHaveLength(0);
    expect(notices).toHaveLength(0);
  });

  it('respects disabled preferences and notification permission', () => {
    page.dispatchEvent(new Event('pointerdown'));
    alerts.setSound(false);
    alerts.setNotifications(false);
    alerts.update(turn());
    expect(tones).toHaveLength(0);
    expect(notices).toHaveLength(0);
    alerts.setNotifications(true);
    FakeNotification.permission = 'denied';
    alerts.update(turn(2));
    expect(notices).toHaveLength(0);
  });

  it('focuses the game on notification click and closes stale notices on return', () => {
    alerts.update(turn());
    notices[0]!.onclick?.();
    expect(browser.focus).toHaveBeenCalledOnce();
    expect(notices[0]!.close).toHaveBeenCalledOnce();
    page.hidden = false;
    focused = true;
    page.dispatchEvent(new Event('visibilitychange'));
    expect(notices[0]!.close).toHaveBeenCalledTimes(2);
  });

  it('distinguishes turns across matches and disposes resources/listeners', () => {
    page.dispatchEvent(new Event('pointerdown'));
    alerts.update(turn());
    alerts.update({ ...turn(), gameId: 'match-2' });
    expect(notices).toHaveLength(2);
    alerts.dispose();
    expect(notices[1]!.close).toHaveBeenCalledOnce();
    expect(audioClosed).toHaveBeenCalledOnce();
    page.dispatchEvent(new Event('pointerdown'));
    alerts.dispose();
    expect(audioClosed).toHaveBeenCalledOnce();
  });

  it('continues safely if the browser cannot construct a notification', () => {
    vi.stubGlobal(
      'Notification',
      class {
        static permission = 'granted';
        constructor() {
          throw new Error('Unsupported desktop notifications');
        }
      },
    );
    expect(() => alerts.update(turn())).not.toThrow();
  });
});
