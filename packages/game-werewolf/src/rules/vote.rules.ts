import type { WerewolfState } from '../domain/state.js';
import { getPlayer } from './players.js';

/** The single option with the most weight behind it, or null when the lead is shared. */
function findLeader(tally: ReadonlyMap<string | null, number>): string | null {
  let leader: string | null = null;
  let best = 0;
  let shared = false;
  for (const [option, weight] of tally) {
    if (weight > best) {
      leader = option;
      best = weight;
      shared = false;
    } else if (weight === best) {
      shared = true;
    }
  }
  return shared ? null : leader;
}

/**
 * Who the village executes: the player with more votes than any other choice, sparing
 * everyone included. A tie executes nobody.
 */
export function tallyVillageVote(votes: Readonly<Record<string, string | null>>): string | null {
  const tally = new Map<string | null, number>();
  for (const targetId of Object.values(votes)) tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  return findLeader(tally);
}

/** Who the pack attacks. The alpha's vote weighs more; a tie means nobody is attacked. */
export function tallyWolfVote(state: WerewolfState): string | null {
  const tally = new Map<string | null, number>();
  for (const [wolfId, targetId] of Object.entries(state.night?.wolfVotes ?? {})) {
    const weight =
      getPlayer(state, wolfId).role === 'alphaWerewolf' ? state.setup.rules.alphaVoteWeight : 1;
    tally.set(targetId, (tally.get(targetId) ?? 0) + weight);
  }
  return findLeader(tally);
}
