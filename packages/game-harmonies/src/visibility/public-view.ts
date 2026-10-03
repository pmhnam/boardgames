import type { GameViewer } from '@bgp/game-core';
import type { Stack } from '../domain/board.js';
import { getCard, isCardComplete, type AnimalCard } from '../domain/cards.js';
import type { WaterScoring } from '../domain/game-config.js';
import type { Hex } from '../domain/hex.js';
import type { HarmoniesPhase, HarmoniesState, HarmoniesTurn } from '../domain/state.js';
import type { TokenColor } from '../domain/tokens.js';
import { countCardsInProgress, validateTakeCard } from '../rules/card.rules.js';
import { getCubeTargets } from '../rules/habitat.rules.js';
import { getLegalTokenCells } from '../rules/token-placement.rules.js';
import { getBoard, validateEndTurn } from '../rules/turn.rules.js';
import { calculateScores, type ScoreBreakdown } from '../scoring/score.js';

export interface PlayerCardView {
  card: AnimalCard;
  cubesPlaced: number;
  complete: boolean;
}

export interface PlayerBoardView {
  stacks: Record<string, Stack>;
  cubes: string[];
  cards: PlayerCardView[];
  cardsInProgress: number;
}

/** What the viewer may do right now. All empty/false unless it is the viewer's turn. */
export interface LegalMovesView {
  canTakeTokens: boolean;
  canTakeCard: boolean;
  canEndTurn: boolean;
  /** For each colour in hand, the cells it may go on. */
  tokenCells: Partial<Record<TokenColor, Hex[]>>;
  /** For each unfinished card, the cells its next cube may go on. */
  cubeCells: Record<string, Hex[]>;
}

export interface HarmoniesView {
  id: string;
  phase: HarmoniesPhase;
  turnOrder: string[];
  turn: HarmoniesTurn;
  /** The map this match is played on. */
  map: { id: string; name: string };
  /** The shape of every player's board in this match. */
  boardCells: Hex[];
  /** How the water column of the score is worked out in this match. */
  waterScoring: WaterScoring;
  centralSpaces: TokenColor[][];
  /** The pouch and the deck are hidden draw piles: viewers only learn their size. */
  pouchCount: number;
  cardDeckCount: number;
  cardRiver: AnimalCard[];
  boards: Record<string, PlayerBoardView>;
  scores: Record<string, ScoreBreakdown>;
  finalRound: boolean;
  winnerPlayerIds: string[];
  legal: LegalMovesView;
}

const NO_LEGAL_MOVES: LegalMovesView = {
  canTakeTokens: false,
  canTakeCard: false,
  canEndTurn: false,
  tokenCells: {},
  cubeCells: {},
};

function getLegalMoves(state: HarmoniesState, playerId: string): LegalMovesView {
  const board = getBoard(state, playerId);
  const card = (cardId: string) => getCard(state.config.cards, cardId);
  return {
    canTakeTokens: !state.turn.tokensTaken && state.centralSpaces.some((space) => space.length > 0),
    canTakeCard: state.cardRiver.some((cardId) => validateTakeCard(state, board, cardId).valid),
    canEndTurn: validateEndTurn(state).valid,
    tokenCells: Object.fromEntries(
      [...new Set(state.turn.hand)].map((color) => [
        color,
        getLegalTokenCells(state.config, board, color),
      ]),
    ),
    cubeCells: Object.fromEntries(
      board.cards
        .filter((owned) => !isCardComplete(card(owned.cardId), owned.cubesPlaced))
        .map((owned) => [owned.cardId, getCubeTargets(board, card(owned.cardId))]),
    ),
  };
}

/**
 * Everything on the table is public; the order of the pouch and of the card deck is not.
 * The view is assembled field by field so new state never leaks by default.
 */
export function getPublicView(state: HarmoniesState, viewer: GameViewer): HarmoniesView {
  const isActiveViewer =
    viewer.type === 'player' &&
    state.phase === 'PLAYING' &&
    state.turn.activePlayerId === viewer.playerId;
  const { cards } = state.config;

  return {
    id: state.id,
    phase: state.phase,
    turnOrder: [...state.turnOrder],
    map: { id: state.config.mapId, name: state.config.mapName },
    boardCells: state.config.boardCells.map((cell) => ({ ...cell })),
    waterScoring: state.config.waterScoring,
    turn: { ...state.turn, hand: [...state.turn.hand] },
    centralSpaces: state.centralSpaces.map((space) => [...space]),
    pouchCount: state.pouch.length,
    cardDeckCount: state.cardDeck.length,
    cardRiver: state.cardRiver.map((cardId) => getCard(cards, cardId)),
    boards: Object.fromEntries(
      state.turnOrder.map((playerId) => {
        const board = getBoard(state, playerId);
        return [
          playerId,
          {
            stacks: board.stacks,
            cubes: [...board.cubes],
            cards: board.cards.map((owned) => {
              const card = getCard(cards, owned.cardId);
              return {
                card,
                cubesPlaced: owned.cubesPlaced,
                complete: isCardComplete(card, owned.cubesPlaced),
              };
            }),
            cardsInProgress: countCardsInProgress(cards, board),
          },
        ];
      }),
    ),
    scores: calculateScores(state),
    finalRound: state.finalRound,
    winnerPlayerIds: [...state.winnerPlayerIds],
    legal: isActiveViewer ? getLegalMoves(state, viewer.playerId) : NO_LEGAL_MOVES,
  };
}
