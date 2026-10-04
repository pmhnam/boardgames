import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type ApiError,
  type GameStateMessage,
} from '@bgp/shared-types';
import { useCallback, useEffect, useState } from 'react';
import { getGameUi } from '../../games/registry';
import { useSocket } from '../../shared/websocket/SocketProvider';
import { useGameAction } from '../../shared/websocket/useGameAction';

export interface MatchState {
  message: GameStateMessage | null;
  /** Why the match could not be loaded at all. */
  loadError: ApiError | null;
  /** Why the last action was refused. Cleared by the next accepted one. */
  actionError: ApiError | null;
  pending: boolean;
  sendAction(action: unknown): void;
}

/** How often an action is sent again before the player is told it did not go through. */
const MAX_RESENDS = 3;

/**
 * The client's copy of a match: whatever the server last said. It is fetched on every
 * (re)connect and replaced by each `game.state` push; nothing is ever computed locally.
 */
export function useMatchState(gameId: string): MatchState {
  const socket = useSocket();
  const send = useGameAction<unknown>();
  const [message, setMessage] = useState<GameStateMessage | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  const accept = useCallback((incoming: GameStateMessage) => {
    setMessage((current) => (current && current.version > incoming.version ? current : incoming));
  }, []);

  const sync = useCallback(async (): Promise<GameStateMessage | null> => {
    if (!socket) return null;
    const ack: Ack<GameStateMessage> = await socket.emitWithAck(ClientEvents.GameSync, { gameId });
    if (ack.ok) {
      setLoadError(null);
      accept(ack.data);
      return ack.data;
    }
    setLoadError(ack.error);
    return null;
  }, [socket, gameId, accept]);

  useEffect(() => {
    if (!socket) return;
    const onConnect = () => void sync();
    const onState = (incoming: GameStateMessage) => {
      if (incoming.gameId === gameId) accept(incoming);
    };
    socket.on('connect', onConnect);
    socket.on(ServerEvents.GameState, onState);
    if (socket.connected) void sync();
    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.GameState, onState);
    };
  }, [socket, gameId, sync, accept]);

  const sendAction = useCallback(
    (action: unknown) => {
      if (!message || pending) return;
      setPending(true);
      const resendOnConflict = getGameUi(message.gameType)?.resendOnConflict === true;
      const attempt = async (expectedVersion: number, resendsLeft: number): Promise<void> => {
        const ack = await send({ gameId, expectedVersion, action });
        if (ack.ok || ack.error.code !== ErrorCodes.GameVersionConflict) {
          setActionError(ack.ok ? null : ack.error);
          return;
        }
        // Our copy was stale: fetch the authoritative state instead of guessing.
        const fresh = await sync();
        if (resendOnConflict && fresh && resendsLeft > 0) {
          return attempt(fresh.version, resendsLeft - 1);
        }
        setActionError(ack.error);
      };
      void attempt(message.version, MAX_RESENDS).finally(() => setPending(false));
    },
    [message, pending, send, gameId, sync],
  );

  return { message, loadError, actionError, pending, sendAction };
}
