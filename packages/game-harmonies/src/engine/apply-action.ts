import { GameRuleError, type GameActionContext } from '@bgp/game-core';
import type {
  HarmoniesAction,
  PlaceCubeAction,
  PlaceTokenAction,
  TakeCardAction,
} from '../domain/actions.js';
import { stackAt, type PlayerBoard } from '../domain/board.js';
import { CARD_RIVER_SIZE, TOKENS_PER_SPACE } from '../domain/config.js';
import { hexKey } from '../domain/hex.js';
import type { HarmoniesState } from '../domain/state.js';
import { determineWinners, triggersFinalRound } from '../rules/end-game.rules.js';
import { getBoard, getNextPlayerId, isLastInRound } from '../rules/turn.rules.js';
import { validateAction } from './validate-action.js';

function withBoard(state: HarmoniesState, playerId: string, board: PlayerBoard): HarmoniesState {
  return { ...state, boards: { ...state.boards, [playerId]: board } };
}

function applyTakeTokens(state: HarmoniesState, spaceIndex: number): HarmoniesState {
  return {
    ...state,
    centralSpaces: state.centralSpaces.map((space, index) => (index === spaceIndex ? [] : space)),
    turn: { ...state.turn, tokensTaken: true, hand: [...(state.centralSpaces[spaceIndex] ?? [])] },
  };
}

function applyPlaceToken(
  state: HarmoniesState,
  action: PlaceTokenAction,
  playerId: string,
): HarmoniesState {
  const board = getBoard(state, playerId);
  const hand = [...state.turn.hand];
  hand.splice(hand.indexOf(action.color), 1);

  return {
    ...withBoard(state, playerId, {
      ...board,
      stacks: {
        ...board.stacks,
        [hexKey(action.cell)]: [...stackAt(board, action.cell), action.color],
      },
    }),
    turn: { ...state.turn, hand },
  };
}

function applyTakeCard(
  state: HarmoniesState,
  action: TakeCardAction,
  playerId: string,
): HarmoniesState {
  const board = getBoard(state, playerId);
  return {
    ...withBoard(state, playerId, {
      ...board,
      cards: [...board.cards, { cardId: action.cardId, cubesPlaced: 0 }],
    }),
    cardRiver: state.cardRiver.filter((cardId) => cardId !== action.cardId),
    turn: { ...state.turn, cardTaken: true },
  };
}

function applyPlaceCube(
  state: HarmoniesState,
  action: PlaceCubeAction,
  playerId: string,
): HarmoniesState {
  const board = getBoard(state, playerId);
  return withBoard(state, playerId, {
    ...board,
    cubes: [...board.cubes, hexKey(action.cell)],
    cards: board.cards.map((card) =>
      card.cardId === action.cardId ? { ...card, cubesPlaced: card.cubesPlaced + 1 } : card,
    ),
  });
}

/** Refills empty central spaces and the card row from the hidden draw piles. */
function refill(state: HarmoniesState): HarmoniesState {
  const pouch = [...state.pouch];
  const centralSpaces = state.centralSpaces.map((space) =>
    space.length === 0 ? pouch.splice(-TOKENS_PER_SPACE).reverse() : space,
  );
  const cardDeck = [...state.cardDeck];
  const cardRiver = [...state.cardRiver];
  while (cardRiver.length < CARD_RIVER_SIZE && cardDeck.length > 0) {
    cardRiver.push(cardDeck.pop() as string);
  }
  return { ...state, pouch, centralSpaces, cardDeck, cardRiver };
}

function applyEndTurn(state: HarmoniesState, playerId: string): HarmoniesState {
  const finalRound = state.finalRound || triggersFinalRound(state, playerId);

  if (finalRound && isLastInRound(state, playerId)) {
    return {
      ...state,
      phase: 'FINISHED',
      finalRound: true,
      turn: { ...state.turn, hand: [] },
      winnerPlayerIds: determineWinners(state),
    };
  }

  return {
    ...refill(state),
    finalRound,
    turn: {
      number: state.turn.number + 1,
      activePlayerId: getNextPlayerId(state, playerId),
      tokensTaken: false,
      hand: [],
      cardTaken: false,
    },
  };
}

export function applyAction(
  state: HarmoniesState,
  action: HarmoniesAction,
  context: GameActionContext,
): HarmoniesState {
  const validation = validateAction(state, action, context);
  if (!validation.valid) {
    throw new GameRuleError(validation.code, validation.message);
  }

  const playerId = context.actorPlayerId;
  switch (action.type) {
    case 'TAKE_TOKENS':
      return applyTakeTokens(state, action.spaceIndex);
    case 'PLACE_TOKEN':
      return applyPlaceToken(state, action, playerId);
    case 'TAKE_CARD':
      return applyTakeCard(state, action, playerId);
    case 'PLACE_CUBE':
      return applyPlaceCube(state, action, playerId);
    case 'END_TURN':
      return applyEndTurn(state, playerId);
  }
}
