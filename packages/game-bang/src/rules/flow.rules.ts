import { isRed, setsOffDynamite } from '../domain/cards.js';
import type { BangPending, BangState, IndiansPending, Pending } from '../domain/state.js';
import { damage } from './damage.rules.js';
import { addLog, check, drawCards, removeCard, takeFromDeck } from './deck.rules.js';
import { findInPlay, getCard, getNextAliveId, getOthersFrom, getPlayer } from './players.js';

/** Cards drawn at the start of a turn. */
const TURN_DRAW = 2;
/** Cards Kit Carlson looks at to keep that many. */
const KIT_LOOK = 3;

export function beginTurn(draft: BangState, playerId: string): void {
  draft.turn = { number: draft.turn.number + 1, playerId, step: 'DYNAMITE', bangsPlayed: 0 };
  addLog(draft, { type: 'TURN', playerId });
}

/** The dynamite goes off in its holder's face, or moves on to the next player without one. */
function resolveDynamite(draft: BangState, playerId: string): void {
  const player = getPlayer(draft, playerId);
  const cardId = findInPlay(draft, player, 'dynamite');
  if (cardId === undefined) return;

  const safe = check(draft, playerId, 'dynamite', (card) => !setsOffDynamite(card));
  if (!safe) {
    removeCard(draft, playerId, cardId);
    draft.discard.push(cardId);
    damage(draft, playerId, draft.setup.rules.dynamiteDamage, null);
    return;
  }
  const nextId = getOthersFrom(draft, playerId).find(
    (otherId) => findInPlay(draft, getPlayer(draft, otherId), 'dynamite') === undefined,
  );
  if (nextId === undefined) return;
  removeCard(draft, playerId, cardId);
  getPlayer(draft, nextId).inPlay.push(cardId);
}

/** Whether the player gets to play their turn. Either way the jail is discarded. */
function resolveJail(draft: BangState, playerId: string): boolean {
  const cardId = findInPlay(draft, getPlayer(draft, playerId), 'jail');
  if (cardId === undefined) return true;
  removeCard(draft, playerId, cardId);
  draft.discard.push(cardId);
  return check(draft, playerId, 'jail', (card) => card.suit === 'hearts');
}

/** The first phase of a turn, which some characters go about their own way. */
function startDraw(draft: BangState, playerId: string): void {
  const player = getPlayer(draft, playerId);

  if (player.character === 'kitCarlson') {
    const cardIds = takeFromDeck(draft, KIT_LOOK);
    if (cardIds.length < KIT_LOOK) player.hand.push(...cardIds);
    else draft.pending.push({ type: 'KIT', playerId, cardIds });
    return;
  }
  if (player.character === 'jesseJones') {
    const anyHand = getOthersFrom(draft, playerId).some(
      (otherId) => getPlayer(draft, otherId).hand.length > 0,
    );
    if (anyHand) {
      draft.pending.push({ type: 'DRAW', playerId });
      return;
    }
  }
  if (player.character === 'pedroRamirez' && draft.discard.length > 0) {
    draft.pending.push({ type: 'DRAW', playerId });
    return;
  }

  const drawn = drawCards(draft, playerId, TURN_DRAW);
  const second = drawn[1];
  if (player.character === 'blackJack' && second !== undefined) {
    const lucky = isRed(getCard(draft, second));
    const extra = lucky ? drawCards(draft, playerId, 1).length : 0;
    addLog(draft, {
      type: 'DRAW',
      playerId,
      count: drawn.length + extra,
      from: 'deck',
      shownCardId: second,
    });
  }
}

/**
 * Moves the turn on while nothing is pending. Returns true once the active player is free
 * to play.
 */
function advanceTurn(draft: BangState): boolean {
  const { playerId, step } = draft.turn;
  if (!getPlayer(draft, playerId).alive) {
    beginTurn(draft, getNextAliveId(draft, playerId));
    return false;
  }
  switch (step) {
    case 'DYNAMITE':
      draft.turn.step = 'JAIL';
      resolveDynamite(draft, playerId);
      return false;
    case 'JAIL':
      if (resolveJail(draft, playerId)) draft.turn.step = 'DRAW';
      else beginTurn(draft, getNextAliveId(draft, playerId));
      return false;
    case 'DRAW':
      draft.turn.step = 'PLAY';
      startDraw(draft, playerId);
      return false;
    case 'PLAY':
      return true;
  }
}

function pop(draft: BangState): void {
  draft.pending.pop();
}

/**
 * Brings a shot to bear on the next player in its queue. Barrels are tried for them; what
 * they do not stop is left for the player to answer.
 */
function advanceShot(draft: BangState, frame: BangPending): boolean {
  const targetId = frame.queue[0];
  if (targetId === undefined) {
    pop(draft);
    return false;
  }
  const target = getPlayer(draft, targetId);
  if (!target.alive) {
    frame.queue.shift();
    frame.ready = false;
    return false;
  }

  if (!frame.ready) {
    let needed = frame.perTarget;
    const barrels =
      (target.character === 'jourdonnais' ? 1 : 0) + (findInPlay(draft, target, 'barrel') ? 1 : 0);
    for (let tried = 0; tried < barrels && needed > 0; tried += 1) {
      if (check(draft, targetId, 'barrel', (card) => card.suit === 'hearts')) needed -= 1;
    }
    if (needed <= 0) {
      frame.queue.shift();
      return false;
    }
    frame.missedNeeded = needed;
    frame.ready = true;
  }
  // An empty hand is no secret, so there is nothing to wait for.
  if (target.hand.length === 0) {
    frame.queue.shift();
    frame.ready = false;
    damage(draft, targetId, 1, frame.sourceId);
    return false;
  }
  return true;
}

function advanceIndians(draft: BangState, frame: IndiansPending): boolean {
  const targetId = frame.queue[0];
  if (targetId === undefined) {
    pop(draft);
    return false;
  }
  const target = getPlayer(draft, targetId);
  if (!target.alive) {
    frame.queue.shift();
    return false;
  }
  if (target.hand.length === 0) {
    frame.queue.shift();
    damage(draft, targetId, 1, frame.sourceId);
    return false;
  }
  return true;
}

/**
 * Does whatever the innermost pending frame can do without a player. Returns true when it
 * is waiting on one.
 */
function advancePending(draft: BangState, frame: Pending): boolean {
  switch (frame.type) {
    case 'BANG':
      return advanceShot(draft, frame);
    case 'INDIANS':
      return advanceIndians(draft, frame);
    case 'DUEL':
      if (getPlayer(draft, frame.playerId).hand.length > 0) return true;
      pop(draft);
      damage(draft, frame.playerId, 1, frame.opponentId);
      return false;
    case 'STORE': {
      const pickerId = frame.queue[0];
      const last = frame.cardIds[0];
      if (pickerId === undefined || last === undefined) {
        draft.discard.push(...frame.cardIds);
        pop(draft);
        return false;
      }
      if (frame.cardIds.length > 1) return true;
      // The last card on offer goes to the last player without asking.
      getPlayer(draft, pickerId).hand.push(last);
      addLog(draft, { type: 'PICK', playerId: pickerId, cardId: last });
      pop(draft);
      return false;
    }
    case 'DRAW':
    case 'KIT':
    case 'DYING':
      return true;
  }
}

/** Suzy Lafayette draws as soon as her hand is empty, though not in the middle of a duel. */
function refillSuzy(draft: BangState): void {
  if (draft.pending.at(-1)?.type === 'DUEL') return;
  for (const playerId of draft.seatOrder) {
    const player = getPlayer(draft, playerId);
    if (player.alive && player.character === 'suzyLafayette' && player.hand.length === 0) {
      const drawn = drawCards(draft, playerId, 1);
      if (drawn.length > 0) {
        addLog(draft, { type: 'DRAW', playerId, count: 1, from: 'deck', shownCardId: null });
      }
    }
  }
}

/**
 * Runs the match forward until it needs a player: through barrels, dynamite, jail, the draw
 * phase and whatever else resolves without a decision. Every action ends here.
 */
export function settle(draft: BangState): void {
  for (;;) {
    if (draft.phase === 'FINISHED') {
      draft.pending = [];
      return;
    }
    refillSuzy(draft);
    const frame = draft.pending.at(-1);
    if (frame ? advancePending(draft, frame) : advanceTurn(draft)) return;
  }
}
