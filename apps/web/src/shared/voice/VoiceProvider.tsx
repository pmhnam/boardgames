import type { ApiError } from '@bgp/shared-types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useSocket } from '../websocket/SocketProvider';
import { VoiceCall, type CallEnd, type CallState, type VoiceProblem } from './VoiceCall';

/** Why the viewer is not in a call they asked for, or no longer in the one they were in. */
export type VoiceNotice =
  | { kind: 'problem'; problem: VoiceProblem }
  | { kind: 'refused'; error: ApiError }
  | { kind: 'removed' };

interface VoiceActions {
  join(roomId: string): void;
  leave(): void;
  toggleMute(): void;
  dismissNotice(): void;
  /** Says which room's call the page in view could join, or that it has none. */
  offer(roomId: string | null): void;
}

interface VoiceView {
  call: CallState | null;
  offeredRoomId: string | null;
  notice: VoiceNotice | null;
}

const ActionsContext = createContext<VoiceActions | null>(null);
const ViewContext = createContext<VoiceView>({ call: null, offeredRoomId: null, notice: null });

function noticeFor(end: CallEnd): VoiceNotice | null {
  if (end.reason === 'problem') return { kind: 'problem', problem: end.problem };
  if (end.reason === 'refused') return { kind: 'refused', error: end.error };
  if (end.reason === 'removed') return { kind: 'removed' };
  return null;
}

/**
 * The viewer's call, kept above the pages: a room's call goes on while its people move from
 * the room into the match and back, so it cannot belong to either page.
 */
export function VoiceProvider({ children }: { children: ReactNode }) {
  const socket = useSocket();
  const current = useRef<VoiceCall | null>(null);
  const [call, setCall] = useState<CallState | null>(null);
  const [offeredRoomId, setOfferedRoomId] = useState<string | null>(null);
  const [notice, setNotice] = useState<VoiceNotice | null>(null);
  const muted = useRef(false);
  muted.current = call?.muted ?? false;

  const actions = useMemo<VoiceActions>(
    () => ({
      join(roomId) {
        if (!socket) return;
        current.current?.leave();
        setNotice(null);
        const started: VoiceCall = new VoiceCall(
          socket,
          roomId,
          (state) => {
            if (current.current === started) setCall(state);
          },
          (end) => {
            if (current.current !== started) return;
            current.current = null;
            setCall(null);
            setNotice(noticeFor(end));
          },
        );
        current.current = started;
        void started.start();
      },
      leave() {
        current.current?.leave();
      },
      toggleMute() {
        current.current?.setMuted(!muted.current);
      },
      dismissNotice() {
        setNotice(null);
      },
      offer: setOfferedRoomId,
    }),
    [socket],
  );

  // Signing out, or the connection being replaced, ends the call with it.
  useEffect(
    () => () => {
      current.current?.leave();
      current.current = null;
    },
    [socket],
  );

  const view = useMemo(() => ({ call, offeredRoomId, notice }), [call, offeredRoomId, notice]);
  return (
    <ActionsContext.Provider value={actions}>
      <ViewContext.Provider value={view}>{children}</ViewContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useVoiceActions(): VoiceActions {
  const actions = useContext(ActionsContext);
  if (!actions) throw new Error('useVoiceActions needs a VoiceProvider above it');
  return actions;
}

export function useVoiceView(): VoiceView {
  return useContext(ViewContext);
}

/**
 * For a page that belongs to a room: its call can be joined from the header for as long as the
 * page is in view. The call itself, once joined, does not end with the page.
 */
export function useVoiceRoom(roomId: string | null | undefined): void {
  const offer = useContext(ActionsContext)?.offer;
  const offered = roomId ?? null;
  const set = useCallback((value: string | null) => offer?.(value), [offer]);
  useEffect(() => {
    set(offered);
    return () => set(null);
  }, [offered, set]);
}
