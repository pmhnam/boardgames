import type { SplendorState } from '../domain/state.js';
import { calculateScores } from '../scoring/score.js';
import { getPlayer } from './turn.rules.js';

/** Most prestige wins; a tie goes to whoever bought fewer cards; a tie there is shared. */
export function determineWinners(
  state: Pick<SplendorState, 'config' | 'players' | 'turnOrder'>,
): string[] {
  const scores = calculateScores(state);
  const best = Math.max(...Object.values(scores));
  const leaders = state.turnOrder.filter((playerId) => scores[playerId] === best);
  const cardsOf = (playerId: string) => getPlayer(state, playerId).purchased.length;
  const fewest = Math.min(...leaders.map(cardsOf));
  return leaders.filter((playerId) => cardsOf(playerId) === fewest);
}
