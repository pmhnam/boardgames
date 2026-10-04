import { GameRuleError, type GameActionContext } from '@bgp/game-core';
import type { BangAction } from '../domain/actions.js';
import type { BangState } from '../domain/state.js';
import { cloneState } from '../rules/deck.rules.js';
import { settle } from '../rules/flow.rules.js';
import { playCard } from '../rules/play.rules.js';
import { chooseDraw, discardToHeal, endTurn, pickCards, respond } from '../rules/response.rules.js';
import { validateAction } from './validate-action.js';

/**
 * The action is carried out on a private copy of the state, which is then run forward to
 * the next point where a player has to decide something.
 */
export function applyAction(
  state: BangState,
  action: BangAction,
  context: GameActionContext,
): BangState {
  const validation = validateAction(state, action, context);
  if (!validation.valid) throw new GameRuleError(validation.code, validation.message);

  const draft = cloneState(state);
  const playerId = context.actorPlayerId;
  switch (action.type) {
    case 'PLAY_CARD':
      playCard(draft, playerId, action);
      break;
    case 'END_TURN':
      endTurn(draft, playerId, action.discardIds);
      break;
    case 'RESPOND':
      respond(draft, playerId, action.cardId);
      break;
    case 'PICK_CARDS':
      pickCards(draft, playerId, action.cardIds);
      break;
    case 'DRAW':
      chooseDraw(draft, playerId, action);
      break;
    case 'DISCARD_TO_HEAL':
      discardToHeal(draft, playerId, action.cardIds);
      break;
  }
  settle(draft);
  return draft;
}
