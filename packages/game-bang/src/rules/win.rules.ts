import type { Winner } from '../domain/roles.js';
import type { BangState } from '../domain/state.js';
import { getAliveIds, getPlayer } from './players.js';

/**
 * The sheriff's death ends the match: for the renegade if they alone are left standing, for
 * the outlaws otherwise. The law wins once nobody but the sheriff and deputies is alive.
 */
export function findWinner(state: BangState): Winner | null {
  const alive = getAliveIds(state).map((playerId) => getPlayer(state, playerId).role);
  if (!alive.includes('sheriff')) {
    return alive.length === 1 && alive[0] === 'renegade' ? 'renegade' : 'outlaws';
  }
  return alive.every((role) => role === 'sheriff' || role === 'deputy') ? 'law' : null;
}

/** A side wins together, its dead included. The renegade who wins is the one still alive. */
export function getWinnerPlayerIds(state: BangState, winner: Winner): string[] {
  return state.seatOrder.filter((playerId) => {
    const player = getPlayer(state, playerId);
    if (winner === 'law') return player.role === 'sheriff' || player.role === 'deputy';
    if (winner === 'outlaws') return player.role === 'outlaw';
    return player.role === 'renegade' && player.alive;
  });
}
