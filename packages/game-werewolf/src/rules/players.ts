import { ROLES, isWolf } from '../domain/roles.js';
import type { PlayerState, WerewolfState } from '../domain/state.js';

export function getPlayer(state: WerewolfState, playerId: string): PlayerState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return player;
}

/** The living, in seat order. */
export function getAliveIds(state: WerewolfState): string[] {
  return state.seatOrder.filter((playerId) => state.players[playerId]?.alive === true);
}

export function getWolfIds(state: WerewolfState): string[] {
  return state.seatOrder.filter((playerId) => isWolf(getPlayer(state, playerId).role));
}

/** The other half of the couple, if this player is in it. */
export function getLoverOf(state: WerewolfState, playerId: string): string | null {
  if (!state.lovers) return null;
  const [first, second] = state.lovers;
  if (playerId === first) return second;
  if (playerId === second) return first;
  return null;
}

/** Lovers from opposite camps play for themselves alone. */
export function isMixedCouple(state: WerewolfState): boolean {
  if (!state.lovers) return false;
  const [first, second] = state.lovers;
  return isWolf(getPlayer(state, first).role) !== isWolf(getPlayer(state, second).role);
}

/** Whether a player's role still does anything: the village's powers die with an executed elder. */
export function hasPower(state: WerewolfState, player: PlayerState): boolean {
  return !(state.powersLost && ROLES[player.role].isVillagePower);
}

export function updatePlayer(
  state: WerewolfState,
  playerId: string,
  patch: Partial<PlayerState>,
): WerewolfState {
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...getPlayer(state, playerId), ...patch } },
  };
}
