import type { GameActionContext, GameValidationResult } from '@bgp/game-core';
import type { BangAction, PlayCardAction } from '../domain/actions.js';
import { BangRuleCodes } from '../domain/errors.js';
import type { BangState } from '../domain/state.js';
import { getDistance } from '../rules/distance.rules.js';
import { getLegalMoves, type LegalMoves } from '../rules/legal-moves.js';
import { checkPlay, getPlayedKind } from '../rules/play.rules.js';
import { getOwingPlayerId, getPlayer } from '../rules/players.js';

const VALID: GameValidationResult = { valid: true };

function reject(code: string, message: string): GameValidationResult {
  return { valid: false, code, message };
}

const WRONG_ACTION = reject(BangRuleCodes.WrongAction, 'That is not what is being asked of you.');
const INVALID_TARGET = reject(BangRuleCodes.InvalidTarget, 'You cannot choose that player.');
const NOT_IN_HAND = reject(BangRuleCodes.CardNotInHand, 'You do not hold that card.');

/** Exactly `count` different cards, each from the pile. */
function isSelection(cardIds: readonly string[], pile: readonly string[], count: number): boolean {
  return (
    cardIds.length === count &&
    new Set(cardIds).size === count &&
    cardIds.every((cardId) => pile.includes(cardId))
  );
}

function validatePlay(
  state: BangState,
  action: PlayCardAction,
  playerId: string,
): GameValidationResult {
  const player = getPlayer(state, playerId);
  if (!player.hand.includes(action.cardId)) return NOT_IN_HAND;
  const play = checkPlay(state, playerId, action.cardId);
  if (!play.ok) return reject(play.code, play.message);
  if (play.targets === null) return VALID;

  const { targetId, targetCardId } = action;
  if (targetId === null) return INVALID_TARGET;
  const target = state.players[targetId];
  const kind = getPlayedKind(state, player, action.cardId);
  if (!play.targets.includes(targetId)) {
    const tooFar =
      (kind === 'bang' || kind === 'panic') &&
      target?.alive === true &&
      targetId !== playerId &&
      (kind === 'bang' || getDistance(state, playerId, targetId) > 1);
    return tooFar
      ? reject(BangRuleCodes.OutOfRange, 'That player is out of range.')
      : INVALID_TARGET;
  }
  if (kind === 'panic' || kind === 'catBalou') {
    // A card on the table is named; one from the hand is taken unseen.
    const there =
      targetCardId === null
        ? (target?.hand.length ?? 0) > 0
        : target?.inPlay.includes(targetCardId) === true;
    if (!there) return reject(BangRuleCodes.InvalidCards, 'That card is not there to take.');
  }
  return VALID;
}

function validateByPrompt(
  state: BangState,
  action: BangAction,
  playerId: string,
  legal: LegalMoves,
): GameValidationResult {
  const hand = getPlayer(state, playerId).hand;

  switch (action.type) {
    case 'PLAY_CARD':
      return legal.prompt === 'PLAY' ? validatePlay(state, action, playerId) : WRONG_ACTION;

    case 'END_TURN':
      if (legal.prompt !== 'PLAY') return WRONG_ACTION;
      return isSelection(action.discardIds, hand, legal.discardCount)
        ? VALID
        : reject(
            BangRuleCodes.InvalidCards,
            `You must discard exactly ${legal.discardCount} of your cards.`,
          );

    case 'RESPOND':
      if (!legal.canPass) return WRONG_ACTION;
      if (action.cardId === null) return VALID;
      if (!hand.includes(action.cardId)) return NOT_IN_HAND;
      return legal.responses.includes(action.cardId)
        ? VALID
        : reject(BangRuleCodes.CardNotPlayable, 'That card is no answer to this.');

    case 'PICK_CARDS':
      if (legal.pickCount === 0) return WRONG_ACTION;
      return isSelection(action.cardIds, legal.picks, legal.pickCount)
        ? VALID
        : reject(
            BangRuleCodes.InvalidCards,
            `You must take exactly ${legal.pickCount} of the cards on offer.`,
          );

    case 'DRAW':
      if (legal.prompt !== 'DRAW') return WRONG_ACTION;
      if (action.source === 'deck') return VALID;
      if (action.source === 'discard') {
        return legal.drawFromDiscard
          ? VALID
          : reject(BangRuleCodes.AbilityNotAvailable, 'You cannot draw from the discard pile.');
      }
      return action.targetId !== null && legal.drawFromPlayers.includes(action.targetId)
        ? VALID
        : INVALID_TARGET;

    case 'DISCARD_TO_HEAL':
      if (!legal.canHeal) {
        return reject(BangRuleCodes.AbilityNotAvailable, 'You cannot trade cards for life now.');
      }
      return isSelection(action.cardIds, hand, 2)
        ? VALID
        : reject(BangRuleCodes.InvalidCards, 'You must discard exactly 2 of your cards.');
  }
}

/**
 * Everything is judged against what `getLegalMoves` offers this player, so a refusal never
 * says more than their own view already does.
 */
export function validateAction(
  state: BangState,
  action: BangAction,
  context: GameActionContext,
): GameValidationResult {
  if (state.phase === 'FINISHED') {
    return reject(BangRuleCodes.GameNotPlaying, 'The match is over.');
  }
  const playerId = context.actorPlayerId;
  if (!state.players[playerId] || getOwingPlayerId(state) !== playerId) {
    return reject(BangRuleCodes.NotYourTurn, 'The match is not waiting on you.');
  }
  return validateByPrompt(state, action, playerId, getLegalMoves(state, playerId));
}
