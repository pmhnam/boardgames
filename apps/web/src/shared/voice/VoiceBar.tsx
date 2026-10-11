import { useEffect, useRef } from 'react';
import { useAuthStore } from '../../features/auth/auth.store';
import { errorText } from '../i18n/errors';
import { useT, type Translate } from '../i18n/useT';
import type { MessageKey } from '../i18n/vi';
import { voiceSupported, type CallPeer, type VoiceProblem } from './VoiceCall';
import { useVoiceActions, useVoiceView, type VoiceNotice } from './VoiceProvider';
import './voice.css';

const PROBLEM_TEXT: Record<VoiceProblem, MessageKey> = {
  unsupported: 'voice.unsupported',
  'mic-denied': 'voice.micDenied',
  'mic-missing': 'voice.micMissing',
  'mic-failed': 'voice.micFailed',
};

function noticeText(t: Translate, notice: VoiceNotice): string {
  if (notice.kind === 'problem') return t(PROBLEM_TEXT[notice.problem]);
  if (notice.kind === 'removed') return t('voice.removed');
  return errorText(t, notice.error);
}

function MicIcon({ off = false }: { off?: boolean }) {
  return (
    <svg className="voice-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
      {off && <path className="voice-icon-slash" d="M4 4l16 16" />}
    </svg>
  );
}

/** Plays one person's voice. It has to be an element on the page for the browser to play it. */
function PeerAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.srcObject = stream;
    void element.play().catch(() => undefined);
    return () => {
      element.srcObject = null;
    };
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

function Person({
  name,
  note,
  muted,
  speaking,
  link,
}: {
  name: string;
  note?: string;
  muted: boolean;
  speaking: boolean;
  link?: CallPeer['link'];
}) {
  const t = useT();
  const state = muted
    ? t('voice.isMuted')
    : link === 'connecting'
      ? t('voice.connecting')
      : link === 'failed'
        ? t('voice.failed')
        : speaking
          ? t('voice.isSpeaking')
          : null;
  const classes = ['voice-person', speaking && 'speaking', muted && 'muted', link]
    .filter(Boolean)
    .join(' ');
  return (
    <li className={classes}>
      <span className="voice-dot" aria-hidden="true">
        {muted && <MicIcon off />}
      </span>
      <span className="voice-name">
        {name}
        {note && <span className="muted"> {note}</span>}
      </span>
      {state && (
        <span className={link === 'connecting' || link === 'failed' ? 'voice-state' : 'sr-only'}>
          {' '}
          {state}
        </span>
      )}
    </li>
  );
}

/** In the header, on a page whose room has a call the viewer is not in. */
export function VoiceJoinButton() {
  const t = useT();
  const { call, offeredRoomId } = useVoiceView();
  const { join } = useVoiceActions();
  if (offeredRoomId === null || call?.roomId === offeredRoomId || !voiceSupported()) return null;
  return (
    <button type="button" className="secondary voice-join" onClick={() => join(offeredRoomId)}>
      <MicIcon />
      <span>{t('voice.join')}</span>
    </button>
  );
}

/**
 * Under the header for as long as the viewer is in a call: who is in it, who is speaking, and
 * the two things to do about it. It stays while they go from page to page.
 */
export function VoiceBar() {
  const t = useT();
  const { call, notice } = useVoiceView();
  const { leave, toggleMute, dismissNotice } = useVoiceActions();
  const myName = useAuthStore((state) => state.session?.user.displayName) ?? '';

  if (!call) {
    if (!notice) return null;
    return (
      <p className="voice-notice" role="alert">
        <span>{noticeText(t, notice)}</span>
        <button type="button" className="secondary" onClick={dismissNotice}>
          {t('voice.dismiss')}
        </button>
      </p>
    );
  }

  return (
    <section className="voice-bar" aria-label={t('voice.label')}>
      <MicIcon />
      {call.status === 'joining' ? (
        <p className="voice-people muted" role="status">
          {t('voice.joining')}
        </p>
      ) : (
        <ul className="voice-people">
          <Person name={myName} note={t('voice.you')} muted={call.muted} speaking={call.speaking} />
          {call.peers.map((peer) => (
            <Person
              key={peer.peerId}
              name={peer.displayName}
              muted={peer.muted}
              speaking={peer.speaking}
              link={peer.link}
            />
          ))}
        </ul>
      )}
      {call.peers.map(
        (peer) => peer.stream && <PeerAudio key={peer.peerId} stream={peer.stream} />,
      )}
      <div className="voice-controls">
        <button
          type="button"
          className={call.muted ? 'voice-mute on' : 'secondary voice-mute'}
          aria-pressed={call.muted}
          onClick={toggleMute}
        >
          <MicIcon off={call.muted} />
          <span>{call.muted ? t('voice.unmute') : t('voice.mute')}</span>
        </button>
        <button type="button" className="secondary voice-leave" onClick={leave}>
          {t('voice.leave')}
        </button>
      </div>
    </section>
  );
}
