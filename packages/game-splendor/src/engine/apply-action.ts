import { GameRuleError, type GameActionContext } from '@bgp/game-core';
import type { SplendorAction } from '../domain/actions.js';
import { getCard, type Tier } from '../domain/cards.js';
import { addTokens, emptyTokens, type GemColor, type TokenCounts } from '../domain/gems.js';
import type { PlayerState, SplendorState } from '../domain/state.js';
import { determineWinners } from '../rules/end-game.rules.js';
import { getExcessTokens } from '../rules/gems.rules.js';
import { getNobleChoices, getWallet } from '../rules/legal-moves.js';
import { getPayment } from '../rules/purchase.rules.js';
import { findMarketSlot } from '../rules/reserve.rules.js';
import { getNextPlayerId, getPlayer, isLastInRound } from '../rules/turn.rules.js';
import { getPoints } from '../scoring/score.js';
import { validateAction } from './validate-action.js';

function withPlayer(state: SplendorState, playerId: string, player: PlayerState): SplendorState {
  return { ...state, players: { ...state.players, [playerId]: player } };
}

/** Moves tokens from the bank to a player. */
function giveTokens(
  state: SplendorState,
  playerId: string,
  tokens: Partial<TokenCounts>,
): SplendorState {
  const player = getPlayer(state, playerId);
  return withPlayer({ ...state, bank: addTokens(state.bank, tokens, -1) }, playerId, {
    ...player,
    tokens: addTokens(player.tokens, tokens),
  });
}

/** Takes the card out of a market slot and refills the slot from its deck, if any is left. */
function refillSlot(state: SplendorState, tier: Tier, slot: number): SplendorState {
  const deck = [...state.decks[tier]];
  const row = [...state.market[tier]];
  row[slot] = deck.pop() ?? null;
  return {
    ...state,
    decks: { ...state.decks, [tier]: deck },
    market: { ...state.market, [tier]: row },
  };
}

function applyTakeGems(
  state: SplendorState,
  playerId: string,
  colors: readonly GemColor[],
): SplendorState {
  const taken = emptyTokens();
  for (const color of colors) taken[color] += 1;
  return giveTokens(state, playerId, taken);
}

/** A reserved card comes with one gold, as long as the bank has any. */
function reserve(
  state: SplendorState,
  playerId: string,
  cardId: string,
  blind: boolean,
): SplendorState {
  const player = getPlayer(state, playerId);
  const withCard = withPlayer(state, playerId, {
    ...player,
    reserved: [...player.reserved, { cardId, blind }],
  });
  return giveTokens(withCard, playerId, { gold: state.bank.gold > 0 ? 1 : 0 });
}

function applyReserveCard(state: SplendorState, playerId: string, cardId: string): SplendorState {
  const found = findMarketSlot(state.market, cardId);
  if (!found) throw new Error(`Card ${cardId} is not face up`);
  return reserve(refillSlot(state, found.tier, found.slot), playerId, cardId, false);
}

function applyReserveFromDeck(state: SplendorState, playerId: string, tier: Tier): SplendorState {
  const deck = [...state.decks[tier]];
  const cardId = deck.pop();
  if (cardId === undefined) throw new Error(`Deck ${tier} is empty`);
  return reserve({ ...state, decks: { ...state.decks, [tier]: deck } }, playerId, cardId, true);
}

function applyBuyCard(state: SplendorState, playerId: string, cardId: string): SplendorState {
  const card = getCard(state.config.cards, cardId);
  const payment = getPayment(getWallet(state, playerId), card.cost);
  if (!payment) throw new Error(`Player ${playerId} cannot afford ${cardId}`);

  // A card bought from the reserve leaves the market untouched.
  const found = findMarketSlot(state.market, cardId);
  const table = found ? refillSlot(state, found.tier, found.slot) : state;
  const player = getPlayer(table, playerId);
  return withPlayer({ ...table, bank: addTokens(table.bank, payment) }, playerId, {
    ...player,
    tokens: addTokens(player.tokens, payment, -1),
    purchased: [...player.purchased, cardId],
    reserved: player.reserved.filter((entry) => entry.cardId !== cardId),
  });
}

function applyReturnGems(
  state: SplendorState,
  playerId: string,
  tokens: Partial<TokenCounts>,
): SplendorState {
  const player = getPlayer(state, playerId);
  return withPlayer({ ...state, bank: addTokens(state.bank, tokens) }, playerId, {
    ...player,
    tokens: addTokens(player.tokens, tokens, -1),
  });
}

function awardNoble(state: SplendorState, playerId: string, nobleId: string): SplendorState {
  const player = getPlayer(state, playerId);
  return withPlayer(
    // A visit changes the scores, so a round of passes that includes one is not a dead end.
    { ...state, nobles: state.nobles.filter((id) => id !== nobleId), passStreak: 0 },
    playerId,
    { ...player, nobles: [...player.nobles, nobleId] },
  );
}

function endTurn(state: SplendorState, playerId: string): SplendorState {
  const reachedTarget =
    getPoints(state.config, getPlayer(state, playerId)) >= state.config.targetScore;
  const finalRound = state.finalRound || reachedTarget;
  const everyonePassed = state.passStreak >= state.turnOrder.length;

  if ((finalRound && isLastInRound(state, playerId)) || everyonePassed) {
    return {
      ...state,
      phase: 'FINISHED',
      finalRound,
      turn: { ...state.turn, step: 'ACTION' },
      winnerPlayerIds: determineWinners(state),
    };
  }
  return {
    ...state,
    finalRound,
    turn: {
      number: state.turn.number + 1,
      activePlayerId: getNextPlayerId(state, playerId),
      step: 'ACTION',
    },
  };
}

/** At most one noble visits per turn: the only one eligible, or the player's pick of several. */
function resolveNobles(state: SplendorState, playerId: string): SplendorState {
  const [first, ...others] = getNobleChoices(state, playerId);
  if (!first) return endTurn(state, playerId);
  if (others.length === 0) return endTurn(awardNoble(state, playerId, first.id), playerId);
  return { ...state, turn: { ...state.turn, step: 'CHOOSE_NOBLE' } };
}

/** What follows every main action: give back excess tokens, then nobles, then the next turn. */
function resolveAfterAction(state: SplendorState, playerId: string): SplendorState {
  if (getExcessTokens(getPlayer(state, playerId).tokens) > 0) {
    return { ...state, turn: { ...state.turn, step: 'RETURN_GEMS' } };
  }
  return resolveNobles(state, playerId);
}

export function applyAction(
  state: SplendorState,
  action: SplendorAction,
  context: GameActionContext,
): SplendorState {
  const validation = validateAction(state, action, context);
  if (!validation.valid) throw new GameRuleError(validation.code, validation.message);

  const playerId = context.actorPlayerId;
  const acted = { ...state, passStreak: 0 };
  switch (action.type) {
    case 'TAKE_GEMS':
      return resolveAfterAction(applyTakeGems(acted, playerId, action.colors), playerId);
    case 'RESERVE_CARD':
      return resolveAfterAction(applyReserveCard(acted, playerId, action.cardId), playerId);
    case 'RESERVE_FROM_DECK':
      return resolveAfterAction(applyReserveFromDeck(acted, playerId, action.tier), playerId);
    case 'BUY_CARD':
      return resolveAfterAction(applyBuyCard(acted, playerId, action.cardId), playerId);
    case 'PASS':
      return resolveAfterAction({ ...state, passStreak: state.passStreak + 1 }, playerId);
    case 'RETURN_GEMS':
      return resolveNobles(applyReturnGems(state, playerId, action.tokens), playerId);
    case 'CHOOSE_NOBLE':
      return endTurn(awardNoble(state, playerId, action.nobleId), playerId);
  }
}
