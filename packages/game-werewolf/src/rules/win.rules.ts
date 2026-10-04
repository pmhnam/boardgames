import { isWolf } from '../domain/roles.js';
import type { Winner, WerewolfState } from '../domain/state.js';
import { getAliveIds, getPlayer, isMixedCouple } from './players.js';

/** Who has won, if anyone has. Checked whenever somebody dies. */
export function findWinner(state: WerewolfState): Winner | null {
  const alive = getAliveIds(state);
  if (alive.length === 0) return 'nobody';

  const lovers = state.lovers;
  if (
    lovers &&
    isMixedCouple(state) &&
    alive.length === 2 &&
    lovers.every((id) => alive.includes(id))
  ) {
    return 'lovers';
  }

  const wolves = alive.filter((playerId) => isWolf(getPlayer(state, playerId).role)).length;
  if (wolves === 0) return 'village';
  // Once the pack is half the table it can no longer be voted out.
  if (wolves * 2 >= alive.length) return 'werewolves';
  return null;
}

/**
 * Everyone on the winning side, dead or alive. Lovers from opposite camps have left theirs:
 * they win together or not at all.
 */
export function getWinnerPlayerIds(state: WerewolfState, winner: Winner): string[] {
  if (winner === 'nobody') return [];
  if (winner === 'lovers') return state.lovers ? [...state.lovers] : [];

  const defected: readonly string[] = isMixedCouple(state) && state.lovers ? state.lovers : [];
  return state.seatOrder.filter(
    (playerId) =>
      !defected.includes(playerId) &&
      isWolf(getPlayer(state, playerId).role) === (winner === 'werewolves'),
  );
}
