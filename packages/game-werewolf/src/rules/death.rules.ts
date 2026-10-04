import type { WerewolfState } from '../domain/state.js';
import { getLoverOf, hasPower } from './players.js';

export interface Deaths {
  state: WerewolfState;
  /** Everyone who died, in seat order, so the order says nothing about how. */
  deaths: string[];
}

/**
 * Kills the named players and everyone their deaths take with them: a lover dies of grief,
 * and a hunter is queued to fire a last shot.
 */
export function killPlayers(state: WerewolfState, victimIds: readonly string[]): Deaths {
  let players = state.players;
  const pendingHunters = [...state.pendingHunters];
  const died: string[] = [];

  const queue = [...victimIds];
  for (let playerId = queue.shift(); playerId !== undefined; playerId = queue.shift()) {
    const player = players[playerId];
    if (!player || !player.alive) continue;
    players = {
      ...players,
      [playerId]: {
        ...player,
        alive: false,
        roleRevealed: player.roleRevealed || state.setup.revealRoleOnDeath,
      },
    };
    died.push(playerId);
    if (player.role === 'hunter' && hasPower(state, player)) pendingHunters.push(playerId);
    const lover = getLoverOf(state, playerId);
    if (lover !== null) queue.push(lover);
  }

  return {
    state: { ...state, players, pendingHunters },
    deaths: state.seatOrder.filter((playerId) => died.includes(playerId)),
  };
}
