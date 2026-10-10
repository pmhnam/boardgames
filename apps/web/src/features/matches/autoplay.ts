import type { GameFinishedMessage, GameStateMessage, PlayerAutoplayDto } from '@bgp/shared-types';

/** Control updates may overtake HTTP replies or game snapshots. Never regress a handoff. */
export function mergeAutoplay(
  current: PlayerAutoplayDto[],
  incoming: PlayerAutoplayDto[],
): PlayerAutoplayDto[] {
  const players = new Map(current.map((player) => [player.playerId, player]));
  for (const player of incoming) {
    const existing = players.get(player.playerId);
    if (!existing || player.version > existing.version) players.set(player.playerId, player);
  }
  return [...players.values()];
}

export function acceptMatchMessage(
  current: GameStateMessage | null,
  incoming: GameStateMessage,
  autoplay: PlayerAutoplayDto[],
): GameStateMessage {
  const state =
    current && current.gameId === incoming.gameId && current.version > incoming.version
      ? current
      : incoming;
  return { ...state, autoplay };
}

/**
 * A match can end without a new state to show, when an administrator ends it. The board stays
 * as it was; only the status moves on.
 */
export function applyFinished(
  current: GameStateMessage | null,
  finished: GameFinishedMessage,
): GameStateMessage | null {
  if (!current || current.gameId !== finished.gameId || current.status === finished.status) {
    return current;
  }
  return { ...current, status: finished.status };
}
