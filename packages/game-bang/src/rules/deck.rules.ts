import { createSeededRandom, type SeededRandom } from '@bgp/game-core';
import type { Card } from '../domain/cards.js';
import type { BangState, CheckReason, LogEvent } from '../domain/state.js';
import { getCard, getPlayer } from './players.js';

/**
 * The functions here and in the other rules files that take a `draft` change it in place.
 * A draft is the private copy `applyAction` makes of the state it was given.
 */

const LOG_LIMIT = 100;

/** A deep copy of a state, which is plain data all the way down. */
export function cloneState<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneState) as T;
  if (value !== null && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) copy[key] = cloneState(child);
    return copy as T;
  }
  return value;
}

export function addLog(draft: BangState, event: LogEvent): void {
  draft.logSeq += 1;
  draft.log.push({ ...event, id: draft.logSeq });
  if (draft.log.length > LOG_LIMIT) draft.log.splice(0, draft.log.length - LOG_LIMIT);
}

/** A fresh source of randomness for each use, so replaying the actions replays the luck. */
export function nextRandom(draft: BangState): SeededRandom {
  draft.rngCounter += 1;
  return createSeededRandom(`${draft.seed}:${draft.rngCounter}`);
}

/**
 * Takes cards off the top of the deck, shuffling the discard pile into a new deck when it
 * runs out. Returns fewer than asked for only when both are empty.
 */
export function takeFromDeck(draft: BangState, count: number): string[] {
  const taken: string[] = [];
  while (taken.length < count) {
    if (draft.deck.length === 0) {
      if (draft.discard.length === 0) break;
      draft.deck = nextRandom(draft).shuffle(draft.discard);
      draft.discard = [];
    }
    const cardId = draft.deck.pop();
    if (cardId !== undefined) taken.push(cardId);
  }
  return taken;
}

export function drawCards(draft: BangState, playerId: string, count: number): string[] {
  const drawn = takeFromDeck(draft, count);
  getPlayer(draft, playerId).hand.push(...drawn);
  return drawn;
}

/** Removes a card from wherever a player holds it. False if they do not. */
export function removeCard(draft: BangState, playerId: string, cardId: string): boolean {
  const player = getPlayer(draft, playerId);
  for (const pile of [player.hand, player.inPlay]) {
    const at = pile.indexOf(cardId);
    if (at >= 0) {
      pile.splice(at, 1);
      return true;
    }
  }
  return false;
}

export function discardFromHand(draft: BangState, playerId: string, cardIds: string[]): void {
  for (const cardId of cardIds) {
    if (removeCard(draft, playerId, cardId)) draft.discard.push(cardId);
  }
}

/** A card picked blind from a hand, and removed from it. */
export function takeRandomFromHand(draft: BangState, playerId: string): string | undefined {
  const hand = getPlayer(draft, playerId).hand;
  if (hand.length === 0) return undefined;
  const [cardId] = hand.splice(nextRandom(draft).int(hand.length), 1);
  return cardId;
}

/**
 * A "draw!": the top of the deck is flipped and discarded, and its suit and rank decide.
 * Lucky Duke flips two and is judged on the better. Passing is the outcome the player wants.
 */
export function check(
  draft: BangState,
  playerId: string,
  reason: CheckReason,
  passes: (card: Card) => boolean,
): boolean {
  const flips = getPlayer(draft, playerId).character === 'luckyDuke' ? 2 : 1;
  const cardIds = takeFromDeck(draft, flips);
  draft.discard.push(...cardIds);
  const passed = cardIds.some((cardId) => passes(getCard(draft, cardId)));
  addLog(draft, { type: 'CHECK', playerId, reason, cardIds, passed });
  return passed;
}
