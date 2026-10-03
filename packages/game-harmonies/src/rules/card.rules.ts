import type { GameValidationResult } from '@bgp/game-core';
import { hasCube, isOnBoard, type PlayerBoard } from '../domain/board.js';
import { getCard, isCardComplete, type AnimalCard } from '../domain/cards.js';
import { MAX_CARDS_IN_PROGRESS } from '../domain/config.js';
import { HarmoniesRuleCodes } from '../domain/errors.js';
import type { HarmoniesSetup } from '../domain/game-config.js';
import type { Hex } from '../domain/hex.js';
import type { HarmoniesState } from '../domain/state.js';
import { habitatMatchesAt } from './habitat.rules.js';

export function countCardsInProgress(
  cards: readonly AnimalCard[],
  board: Pick<PlayerBoard, 'cards'>,
): number {
  return board.cards.filter(
    (owned) => !isCardComplete(getCard(cards, owned.cardId), owned.cubesPlaced),
  ).length;
}

/**
 * One card per turn, from the face-up row, while holding fewer unfinished cards than the limit.
 * A card stops counting once all its animals are placed.
 */
export function validateTakeCard(
  state: Pick<HarmoniesState, 'turn' | 'cardRiver' | 'config'>,
  board: PlayerBoard,
  cardId: string,
): GameValidationResult {
  if (state.turn.cardTaken) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.CardAlreadyTaken,
      message: 'You already took a card this turn.',
    };
  }
  if (!state.cardRiver.includes(cardId)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.CardNotAvailable,
      message: 'That card is not available.',
    };
  }
  if (countCardsInProgress(state.config.cards, board) >= MAX_CARDS_IN_PROGRESS) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.TooManyCards,
      message: `You cannot hold more than ${MAX_CARDS_IN_PROGRESS} unfinished cards.`,
    };
  }
  return { valid: true };
}

export function validatePlaceCube(
  config: HarmoniesSetup,
  board: PlayerBoard,
  cardId: string,
  cell: Hex,
): GameValidationResult {
  const owned = board.cards.find((card) => card.cardId === cardId);
  if (!owned) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.CardNotOwned,
      message: 'You do not have that card.',
    };
  }
  const card = getCard(config.cards, cardId);
  if (isCardComplete(card, owned.cubesPlaced)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.CardCompleted,
      message: 'That card has no animals left to place.',
    };
  }
  if (!isOnBoard(config.boardCells, cell)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.InvalidPosition,
      message: 'That cell is not on your board.',
    };
  }
  if (hasCube(board, cell)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.CellHasCube,
      message: 'That cell already holds an animal.',
    };
  }
  if (!habitatMatchesAt(board, card, cell)) {
    return {
      valid: false,
      code: HarmoniesRuleCodes.HabitatNotMatched,
      message: 'That animal’s habitat is not there.',
    };
  }
  return { valid: true };
}
