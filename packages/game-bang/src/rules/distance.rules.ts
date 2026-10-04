import { DEFAULT_RANGE, getWeaponRangeOf } from '../domain/cards.js';
import type { BangState } from '../domain/state.js';
import { findInPlay, getAliveIds, getPlayer, kindOf } from './players.js';

/**
 * How far one living player sees another: the seats between them the short way round, the
 * dead not counted, moved by a mustang or a scope and by the two characters who are always
 * a step further or nearer. Never less than 1.
 */
export function getDistance(state: BangState, fromId: string, toId: string): number {
  const alive = getAliveIds(state);
  const gap = Math.abs(alive.indexOf(fromId) - alive.indexOf(toId));
  const seats = Math.min(gap, alive.length - gap);

  const from = getPlayer(state, fromId);
  const to = getPlayer(state, toId);
  const further =
    (findInPlay(state, to, 'mustang') ? 1 : 0) + (to.character === 'paulRegret' ? 1 : 0);
  const nearer =
    (findInPlay(state, from, 'scope') ? 1 : 0) + (from.character === 'roseDoolan' ? 1 : 0);
  return Math.max(1, seats + further - nearer);
}

/** How far a player's BANG! reaches. */
export function getWeaponRange(state: BangState, playerId: string): number {
  for (const cardId of getPlayer(state, playerId).inPlay) {
    const range = getWeaponRangeOf(kindOf(state, cardId));
    if (range !== undefined) return range;
  }
  return DEFAULT_RANGE;
}
