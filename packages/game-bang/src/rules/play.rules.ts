import { isBlue, isWeapon, type CardKind } from '../domain/cards.js';
import { BangRuleCodes } from '../domain/errors.js';
import type { PlayCardAction } from '../domain/actions.js';
import type { BangState, PlayerState } from '../domain/state.js';
import { beerHeals, heal } from './damage.rules.js';
import { addLog, drawCards, removeCard, takeFromDeck, takeRandomFromHand } from './deck.rules.js';
import { getDistance, getWeaponRange } from './distance.rules.js';
import { findInPlay, getAliveIds, getOthersFrom, getPlayer, kindOf } from './players.js';

/** Whether a card can be played right now, and on whom. `targets` is null for an unaimed card. */
export type PlayCheck =
  { ok: true; targets: string[] | null } | { ok: false; code: string; message: string };

const UNAIMED: PlayCheck = { ok: true, targets: null };

function refuse(code: string, message: string): PlayCheck {
  return { ok: false, code, message };
}

function aimAt(targets: string[]): PlayCheck {
  return targets.length > 0
    ? { ok: true, targets }
    : refuse(BangRuleCodes.InvalidTarget, 'There is nobody to play that card on.');
}

/** What a card counts as when its holder plays it: Calamity Janet's Missed! is a BANG!. */
export function getPlayedKind(state: BangState, player: PlayerState, cardId: string): CardKind {
  const kind = kindOf(state, cardId);
  return kind === 'missed' && player.character === 'calamityJanet' ? 'bang' : kind;
}

/** The cards in a hand that can stand in for a BANG! or a Missed! when one is called for. */
export function getAnswers(state: BangState, playerId: string, need: 'bang' | 'missed'): string[] {
  const player = getPlayer(state, playerId);
  return player.hand.filter((cardId) => {
    const kind = kindOf(state, cardId);
    if (kind === need) return true;
    return player.character === 'calamityJanet' && (kind === 'bang' || kind === 'missed');
  });
}

function hasCards(player: PlayerState): boolean {
  return player.hand.length + player.inPlay.length > 0;
}

function mayBang(state: BangState, player: PlayerState): boolean {
  return (
    state.turn.bangsPlayed < state.setup.rules.bangsPerTurn ||
    player.character === 'willyTheKid' ||
    findInPlay(state, player, 'volcanic') !== undefined
  );
}

/** Judges a card in the active player's hand, whoever the target turns out to be. */
export function checkPlay(state: BangState, playerId: string, cardId: string): PlayCheck {
  const player = getPlayer(state, playerId);
  const kind = getPlayedKind(state, player, cardId);
  const others = getOthersFrom(state, playerId);

  switch (kind) {
    case 'bang': {
      if (!mayBang(state, player)) {
        return refuse(BangRuleCodes.BangLimit, 'You have already played a BANG! this turn.');
      }
      const range = getWeaponRange(state, playerId);
      const reach = others.filter((otherId) => getDistance(state, playerId, otherId) <= range);
      return reach.length > 0
        ? { ok: true, targets: reach }
        : refuse(BangRuleCodes.OutOfRange, 'Nobody is within range.');
    }
    case 'missed':
      return refuse(BangRuleCodes.CardNotPlayable, 'A Missed! only answers a BANG!.');
    case 'beer':
      if (!beerHeals(state)) {
        return refuse(BangRuleCodes.NoEffect, 'Beer does nothing with so few players left.');
      }
      return player.life < player.maxLife
        ? UNAIMED
        : refuse(BangRuleCodes.NoEffect, 'You are already at full life.');
    case 'panic':
      return aimAt(
        others.filter(
          (otherId) =>
            getDistance(state, playerId, otherId) <= 1 && hasCards(getPlayer(state, otherId)),
        ),
      );
    case 'catBalou':
      return aimAt(others.filter((otherId) => hasCards(getPlayer(state, otherId))));
    case 'duel':
      return aimAt(others);
    case 'jail':
      return aimAt(
        others.filter((otherId) => {
          const other = getPlayer(state, otherId);
          return other.role !== 'sheriff' && findInPlay(state, other, 'jail') === undefined;
        }),
      );
    case 'saloon':
    case 'stagecoach':
    case 'wellsFargo':
    case 'generalStore':
    case 'gatling':
    case 'indians':
      return UNAIMED;
    default:
      return findInPlay(state, player, kind) === undefined
        ? UNAIMED
        : refuse(BangRuleCodes.AlreadyInPlay, 'You already have that card in play.');
  }
}

/** Panic! and Cat Balou: takes the named card off the table, or one unseen from the hand. */
function takeCard(
  draft: BangState,
  playerId: string,
  targetId: string,
  targetCardId: string | null,
  keep: boolean,
): void {
  const cardId = targetCardId ?? takeRandomFromHand(draft, targetId);
  if (cardId === undefined) return;
  if (targetCardId !== null) removeCard(draft, targetId, targetCardId);
  if (keep) getPlayer(draft, playerId).hand.push(cardId);
  else draft.discard.push(cardId);
  addLog(draft, {
    type: 'TAKE',
    playerId,
    fromId: targetId,
    cardId,
    fromHand: targetCardId === null,
    discarded: !keep,
  });
}

function putInPlay(draft: BangState, ownerId: string, cardId: string, kind: CardKind): void {
  const owner = getPlayer(draft, ownerId);
  if (isWeapon(kind)) {
    // A new weapon replaces the old one.
    const old = owner.inPlay.find((held) => isWeapon(kindOf(draft, held)));
    if (old !== undefined) {
      removeCard(draft, ownerId, old);
      draft.discard.push(old);
    }
  }
  owner.inPlay.push(cardId);
}

/**
 * Plays a card the validator has passed. Cards that ask something of other players leave a
 * frame on `pending` for the flow to work through.
 */
export function playCard(draft: BangState, playerId: string, action: PlayCardAction): void {
  const player = getPlayer(draft, playerId);
  const { cardId, targetId } = action;
  const kind = getPlayedKind(draft, player, cardId);
  removeCard(draft, playerId, cardId);
  addLog(draft, { type: 'PLAY', playerId, cardId, targetId });

  if (isBlue(kind)) {
    putInPlay(draft, kind === 'jail' && targetId !== null ? targetId : playerId, cardId, kind);
    return;
  }
  draft.discard.push(cardId);

  switch (kind) {
    case 'bang':
      if (targetId === null) return;
      draft.turn.bangsPlayed += 1;
      draft.pending.push({
        type: 'BANG',
        sourceId: playerId,
        queue: [targetId],
        perTarget: player.character === 'slabTheKiller' ? 2 : 1,
        missedNeeded: 0,
        ready: false,
      });
      return;
    case 'gatling':
      draft.pending.push({
        type: 'BANG',
        sourceId: playerId,
        queue: getOthersFrom(draft, playerId),
        perTarget: 1,
        missedNeeded: 0,
        ready: false,
      });
      return;
    case 'indians':
      draft.pending.push({
        type: 'INDIANS',
        sourceId: playerId,
        queue: getOthersFrom(draft, playerId),
      });
      return;
    case 'duel':
      if (targetId === null) return;
      draft.pending.push({ type: 'DUEL', playerId: targetId, opponentId: playerId });
      return;
    case 'beer':
      heal(draft, playerId, 1);
      return;
    case 'saloon':
      for (const aliveId of getAliveIds(draft)) heal(draft, aliveId, 1);
      return;
    case 'stagecoach':
      drawCards(draft, playerId, 2);
      return;
    case 'wellsFargo':
      drawCards(draft, playerId, 3);
      return;
    case 'generalStore': {
      const queue = [playerId, ...getOthersFrom(draft, playerId)];
      draft.pending.push({ type: 'STORE', queue, cardIds: takeFromDeck(draft, queue.length) });
      return;
    }
    case 'panic':
      if (targetId !== null) takeCard(draft, playerId, targetId, action.targetCardId, true);
      return;
    case 'catBalou':
      if (targetId !== null) takeCard(draft, playerId, targetId, action.targetCardId, false);
      return;
    default:
      return;
  }
}
