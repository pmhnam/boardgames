import type { BangState } from '../domain/state.js';
import { addLog, drawCards, removeCard, takeRandomFromHand } from './deck.rules.js';
import { getAliveIds, getPlayer, kindOf } from './players.js';
import { findWinner, getWinnerPlayerIds } from './win.rules.js';

/** A beer does nothing in the final showdown. */
export function beerHeals(state: BangState): boolean {
  return getAliveIds(state).length >= state.setup.rules.beerMinPlayers;
}

export function heal(draft: BangState, playerId: string, amount: number): void {
  const player = getPlayer(draft, playerId);
  player.life = Math.min(player.maxLife, player.life + amount);
}

/**
 * At zero life a player's beers are drunk for them, but only if that saves them: a beer
 * that would not is left in the hand it is taken from.
 */
function drinkToSurvive(draft: BangState, playerId: string): void {
  const player = getPlayer(draft, playerId);
  if (!beerHeals(draft)) return;
  const beers = player.hand.filter((cardId) => kindOf(draft, cardId) === 'beer');
  const needed = 1 - player.life;
  // Sid Ketchum can make up the difference with other cards.
  if (beers.length < needed && player.character !== 'sidKetchum') return;
  for (const cardId of beers.slice(0, needed)) {
    removeCard(draft, playerId, cardId);
    draft.discard.push(cardId);
    player.life += 1;
    addLog(draft, { type: 'PLAY', playerId, cardId, targetId: null });
  }
}

/** What the characters who profit from being hurt get for a wound they survived. */
function compensate(
  draft: BangState,
  playerId: string,
  amount: number,
  sourceId: string | null,
): void {
  const player = getPlayer(draft, playerId);
  if (player.character === 'bartCassidy') {
    const drawn = drawCards(draft, playerId, amount);
    if (drawn.length > 0) {
      addLog(draft, {
        type: 'DRAW',
        playerId,
        count: drawn.length,
        from: 'deck',
        shownCardId: null,
      });
    }
  }
  if (player.character === 'elGringo' && sourceId !== null && sourceId !== playerId) {
    for (let taken = 0; taken < amount; taken += 1) {
      const cardId = takeRandomFromHand(draft, sourceId);
      if (cardId === undefined) break;
      player.hand.push(cardId);
      addLog(draft, {
        type: 'TAKE',
        playerId,
        fromId: sourceId,
        cardId,
        fromHand: true,
        discarded: false,
      });
    }
  }
}

/**
 * Takes a player out of the match. Their role is shown, their cards go to the discard pile
 * or to Vulture Sam, and whoever did it gets what the deed has coming: three cards for an
 * outlaw, the loss of everything for a sheriff who shot a deputy.
 */
export function eliminate(draft: BangState, playerId: string, killerId: string | null): void {
  const player = getPlayer(draft, playerId);
  player.alive = false;
  player.life = 0;

  const left = [...player.hand, ...player.inPlay];
  player.hand = [];
  player.inPlay = [];
  const looterId =
    getAliveIds(draft).find((id) => getPlayer(draft, id).character === 'vultureSam') ?? null;
  if (looterId !== null) getPlayer(draft, looterId).hand.push(...left);
  else draft.discard.push(...left);
  addLog(draft, {
    type: 'DEATH',
    playerId,
    role: player.role,
    killerId,
    lootedById: looterId,
  });

  const winner = findWinner(draft);
  if (winner !== null) {
    draft.phase = 'FINISHED';
    draft.pending = [];
    draft.winner = winner;
    draft.winnerPlayerIds = getWinnerPlayerIds(draft, winner);
    return;
  }

  if (killerId === null || killerId === playerId) return;
  const killer = getPlayer(draft, killerId);
  if (!killer.alive) return;
  if (player.role === 'outlaw') {
    const drawn = drawCards(draft, killerId, draft.setup.rules.outlawBounty);
    if (drawn.length > 0) {
      addLog(draft, {
        type: 'DRAW',
        playerId: killerId,
        count: drawn.length,
        from: 'deck',
        shownCardId: null,
      });
    }
  }
  if (player.role === 'deputy' && killer.role === 'sheriff') {
    const lost = [...killer.hand, ...killer.inPlay];
    killer.hand = [];
    killer.inPlay = [];
    draft.discard.push(...lost);
    if (lost.length > 0) {
      addLog(draft, { type: 'DISCARD', playerId: killerId, cardIds: lost, reason: 'penalty' });
    }
  }
}

/**
 * Costs a player life points. `sourceId` is whose card did it, or null for a dynamite. A
 * player brought to zero drinks the beers that save them, or is eliminated; Sid Ketchum, who
 * may yet buy the life back with cards, is asked first.
 */
export function damage(
  draft: BangState,
  playerId: string,
  amount: number,
  sourceId: string | null,
): void {
  const player = getPlayer(draft, playerId);
  player.life -= amount;
  addLog(draft, { type: 'HIT', playerId, amount, sourceId });

  if (player.life <= 0) {
    drinkToSurvive(draft, playerId);
    if (player.life <= 0) {
      if (player.character === 'sidKetchum' && player.hand.length >= 2 * (1 - player.life)) {
        draft.pending.push({ type: 'DYING', playerId, killerId: sourceId });
      } else {
        eliminate(draft, playerId, sourceId);
      }
      return;
    }
  }
  compensate(draft, playerId, amount, sourceId);
}
