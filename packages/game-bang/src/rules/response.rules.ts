import type { DrawAction } from '../domain/actions.js';
import type { BangState } from '../domain/state.js';
import { damage, eliminate, heal } from './damage.rules.js';
import { addLog, discardFromHand, drawCards, takeRandomFromHand } from './deck.rules.js';
import { beginTurn } from './flow.rules.js';
import { getNextAliveId, getPlayer } from './players.js';

/**
 * A player's answer to the innermost pending frame: a card that meets it, or null to take
 * what is coming.
 */
export function respond(draft: BangState, playerId: string, cardId: string | null): void {
  const frame = draft.pending.at(-1);
  if (!frame) return;
  if (cardId !== null) {
    discardFromHand(draft, playerId, [cardId]);
    addLog(draft, { type: 'RESPONSE', playerId, cardId });
  }

  switch (frame.type) {
    case 'BANG':
      if (cardId !== null) frame.missedNeeded -= 1;
      if (cardId !== null && frame.missedNeeded > 0) return;
      frame.queue.shift();
      frame.ready = false;
      if (cardId === null) damage(draft, playerId, 1, frame.sourceId);
      return;
    case 'INDIANS':
      frame.queue.shift();
      if (cardId === null) damage(draft, playerId, 1, frame.sourceId);
      return;
    case 'DUEL':
      if (cardId === null) {
        draft.pending.pop();
        damage(draft, playerId, 1, frame.opponentId);
      } else {
        // Their BANG! is on the table: now it is the other one's go.
        frame.playerId = frame.opponentId;
        frame.opponentId = playerId;
      }
      return;
    case 'DYING':
      draft.pending.pop();
      eliminate(draft, playerId, frame.killerId);
      return;
    default:
      return;
  }
}

/** Takes from the cards on offer at the General Store, or Kit Carlson's pick of three. */
export function pickCards(draft: BangState, playerId: string, cardIds: string[]): void {
  const frame = draft.pending.at(-1);
  const player = getPlayer(draft, playerId);
  if (frame?.type === 'STORE') {
    const cardId = cardIds[0];
    if (cardId === undefined) return;
    frame.cardIds = frame.cardIds.filter((offered) => offered !== cardId);
    frame.queue.shift();
    player.hand.push(cardId);
    addLog(draft, { type: 'PICK', playerId, cardId });
  }
  if (frame?.type === 'KIT') {
    draft.pending.pop();
    player.hand.push(...cardIds);
    // What Kit leaves goes back on top of the deck.
    draft.deck.push(...frame.cardIds.filter((offered) => !cardIds.includes(offered)));
  }
}

/** Jesse Jones and Pedro Ramirez draw their first card from where they chose. */
export function chooseDraw(draft: BangState, playerId: string, action: DrawAction): void {
  draft.pending.pop();
  const player = getPlayer(draft, playerId);

  if (action.source === 'discard') {
    const cardId = draft.discard.pop();
    if (cardId !== undefined) {
      player.hand.push(cardId);
      addLog(draft, { type: 'DRAW', playerId, count: 1, from: 'discard', shownCardId: cardId });
    }
    drawCards(draft, playerId, 1);
    return;
  }
  if (action.source === 'player' && action.targetId !== null) {
    const cardId = takeRandomFromHand(draft, action.targetId);
    if (cardId !== undefined) {
      player.hand.push(cardId);
      addLog(draft, {
        type: 'TAKE',
        playerId,
        fromId: action.targetId,
        cardId,
        fromHand: true,
        discarded: false,
      });
    }
    drawCards(draft, playerId, 1);
    return;
  }
  drawCards(draft, playerId, 2);
}

/** Sid Ketchum's two cards for a life point, which can pull him back from the brink. */
export function discardToHeal(draft: BangState, playerId: string, cardIds: string[]): void {
  discardFromHand(draft, playerId, cardIds);
  addLog(draft, { type: 'DISCARD', playerId, cardIds, reason: 'heal' });
  const player = getPlayer(draft, playerId);
  heal(draft, playerId, 1);
  if (draft.pending.at(-1)?.type === 'DYING' && player.life > 0) draft.pending.pop();
}

export function endTurn(draft: BangState, playerId: string, discardIds: string[]): void {
  if (discardIds.length > 0) {
    discardFromHand(draft, playerId, discardIds);
    addLog(draft, { type: 'DISCARD', playerId, cardIds: discardIds, reason: 'limit' });
  }
  beginTurn(draft, getNextAliveId(draft, playerId));
}
