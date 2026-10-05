import {
  ClientEvents,
  ErrorCodes,
  ServerEvents,
  type Ack,
  type ApiError,
  type GameStateMessage,
  type GameAutoplayMessage,
  type PlayerAutoplayDto,
} from '@bgp/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getGameUi } from '../../games/registry';
import { useSocket } from '../../shared/websocket/SocketProvider';
import { useGameAction } from '../../shared/websocket/useGameAction';
import { acceptMatchMessage, mergeAutoplay } from './autoplay';

export interface MatchState {
  message: GameStateMessage | null;
  /** Why the match could not be loaded at all. */
  loadError: ApiError | null;
  /** Why the last action was refused. Cleared by the next accepted one. */
  actionError: ApiError | null;
  pending: boolean;
  sendAction(action: unknown): void;
  acceptControl(message: GameAutoplayMessage): void;
}

/**
 * How often an action is sent again before the player is told it did not go through. A player
 * racing N others loses at most N times, and the largest table seats sixteen.
 */
const MAX_RESENDS = 15;
/** Those who lost the same race spread out over this long before trying again. */
const RESEND_SPREAD_MS = 100;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const control = useRef<{ gameId: string; players: PlayerAutoplayDto[] }>({ gameId, players: [] });
  const activeGameId = useRef(gameId);
  activeGameId.current = gameId;

  const mergeControl = useCallback(
    (incoming: GameAutoplayMessage) => {
      if (incoming.gameId !== gameId || incoming.gameId !== activeGameId.current) return;
      const current = control.current.gameId === gameId ? control.current.players : [];
      control.current = { gameId, players: mergeAutoplay(current, incoming.players) };
    },
    [gameId],
  );

  const acceptControl = useCallback(
    (incoming: GameAutoplayMessage) => {
      if (incoming.gameId !== activeGameId.current) return;
      mergeControl(incoming);
      setMessage((current) =>
        current?.gameId === incoming.gameId && incoming.gameId === gameId
          ? { ...current, autoplay: control.current.players }
          : current,
      );
    },
    [gameId, mergeControl],
  );

  const accept = useCallback(
    (incoming: GameStateMessage) => {
      if (incoming.gameId !== gameId || incoming.gameId !== activeGameId.current) return;
      mergeControl({ gameId, players: incoming.autoplay ?? [] });
      setMessage((current) => acceptMatchMessage(current, incoming, control.current.players));
    },
    [gameId, mergeControl],
  );

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
    socket.on(ServerEvents.GameAutoplay, acceptControl);
    if (socket.connected) void sync();
    return () => {
      socket.off('connect', onConnect);
      socket.off(ServerEvents.GameState, onState);
      socket.off(ServerEvents.GameAutoplay, acceptControl);
    };
  }, [socket, gameId, sync, accept, acceptControl]);

  const sendAction = useCallback(
    (action: unknown) => {
      if (!message || pending) return;
      if (
        message.autoplay?.some(
          (player) => player.playerId === message.viewerPlayerId && player.level !== null,
        )
      )
        return;
      setPending(true);
      const resendOnConflict = getGameUi(message.gameType)?.resendOnConflict === true;
      const attempt = async (expectedVersion: number, resendsLeft: number): Promise<void> => {
        const ack = await send({ gameId, expectedVersion, action });
        if (ack.ok || ack.error.code !== ErrorCodes.GameVersionConflict) {
          setActionError(ack.ok ? null : ack.error);
          return;
        }
        const resend = resendOnConflict && resendsLeft > 0;
        // Everyone who lost this race is about to do the same: waiting a moment each lets most
        // of them fetch a state the others have already moved past.
        if (resend) await pause(Math.random() * RESEND_SPREAD_MS);
        // Our copy was stale: fetch the authoritative state instead of guessing.
        const fresh = await sync();
        if (resend && fresh?.status === 'playing') return attempt(fresh.version, resendsLeft - 1);
        setActionError(ack.error);
      };
      void attempt(message.version, MAX_RESENDS).finally(() => setPending(false));
    },
    [message, pending, send, gameId, sync],
  );

  return {
    message: message?.gameId === gameId ? message : null,
    loadError,
    actionError,
    pending,
    sendAction,
    acceptControl,
  };
}
