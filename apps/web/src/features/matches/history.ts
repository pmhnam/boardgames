import type { MatchDto } from '@bgp/shared-types';

/** How a match went for the one looking at their own history. */
export type Standing = 'playing' | 'abandoned' | 'won' | 'lost' | 'finished';

type ListedMatch = Pick<MatchDto, 'status' | 'players' | 'result'>;

/**
 * "finished" is a match that ended with nothing to say about the viewer: nobody won it, or
 * they were not seated.
 */
export function matchStanding(match: ListedMatch, userId: string | undefined): Standing {
  if (match.status === 'playing') return 'playing';
  if (match.status === 'abandoned') return 'abandoned';
  const winners = match.result?.winnerPlayerIds ?? [];
  const seat = match.players.find((player) => player.userId === userId);
  if (winners.length === 0 || !seat) return 'finished';
  return winners.includes(seat.playerId) ? 'won' : 'lost';
}

/** Everyone else at the table, in seat order. */
export function otherPlayerNames(match: Pick<MatchDto, 'players'>, userId: string | undefined) {
  return [...match.players]
    .sort((a, b) => a.seat - b.seat)
    .filter((player) => player.userId !== userId)
    .map((player) => player.displayName);
}
