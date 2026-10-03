import {
  ClientEvents,
  ErrorCodes,
  type Ack,
  type ApiError,
  type GameActionAccepted,
  type GameActionRequest,
} from '@bgp/shared-types';
import { useCallback } from 'react';
import { useSocket } from './SocketProvider';

const OFFLINE: ApiError = { code: ErrorCodes.Internal, message: 'Not connected.' };

/**
 * Sends player intent to the server. The UI never computes the outcome: the new state arrives
 * as a `game.state` event. Resolves with the server's verdict for this request.
 */
export function useGameAction<TAction>() {
  const socket = useSocket();

  return useCallback(
    async (input: {
      gameId: string;
      expectedVersion: number;
      action: TAction;
    }): Promise<Ack<GameActionAccepted>> => {
      if (!socket?.connected) return { ok: false, error: OFFLINE };
      const request: GameActionRequest<TAction> = { ...input, requestId: crypto.randomUUID() };
      return socket.emitWithAck(ClientEvents.GameAction, request);
    },
    [socket],
  );
}
