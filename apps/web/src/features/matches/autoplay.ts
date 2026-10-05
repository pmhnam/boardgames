import type { GameStateMessage, PlayerAutoplayDto } from '@bgp/shared-types';

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
