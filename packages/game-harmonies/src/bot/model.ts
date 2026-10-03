import { stackAt, type PlayerBoard } from '../domain/board.js';
import { getCard, isCardComplete, type AnimalCard } from '../domain/cards.js';
import type { HarmoniesSetup } from '../domain/game-config.js';
import { hexKey, type Hex } from '../domain/hex.js';
import type { TokenColor } from '../domain/tokens.js';
import { getCubeTargets } from '../rules/habitat.rules.js';
import type { HarmoniesView } from '../visibility/public-view.js';

/** What the bot knows about the match, taken entirely from its own view. */
export interface BotContext extends Pick<HarmoniesSetup, 'boardCells' | 'waterScoring' | 'cards'> {
  /** hexKeys of the cells on the map, for fast lookups. */
  onBoard: ReadonlySet<string>;
  /**
   * What the bot thinks an empty cell is worth keeping. Zero means it does not think about
   * running out of room.
   */
  emptyCellValue: number;
  /** Scores a board; used to choose between several places for an animal. Null: take the first. */
  cubeChooser: ((board: PlayerBoard) => number) | null;
}

export interface CubePlacement {
  cardId: string;
  cell: Hex;
}

export function readView(
  view: HarmoniesView,
  playerId: string,
): { context: BotContext; board: PlayerBoard } {
  const mine = view.boards[playerId];
  if (!mine) throw new Error(`No board for player ${playerId}`);

  // Every card the bot can reason about: the ones it holds and the ones on offer.
  const cards = [...mine.cards.map((owned) => owned.card), ...view.cardRiver];
  return {
    context: {
      boardCells: view.boardCells,
      waterScoring: view.waterScoring,
      cards,
      onBoard: new Set(view.boardCells.map(hexKey)),
      emptyCellValue: 0,
      cubeChooser: null,
    },
    board: {
      stacks: mine.stacks,
      cubes: mine.cubes,
      cards: mine.cards.map((owned) => ({ cardId: owned.card.id, cubesPlaced: owned.cubesPlaced })),
    },
  };
}

export function cardsInProgress(context: BotContext, board: PlayerBoard): AnimalCard[] {
  return board.cards
    .filter((owned) => !isCardComplete(getCard(context.cards, owned.cardId), owned.cubesPlaced))
    .map((owned) => getCard(context.cards, owned.cardId));
}

export function withToken(board: PlayerBoard, color: TokenColor, cell: Hex): PlayerBoard {
  return {
    ...board,
    stacks: { ...board.stacks, [hexKey(cell)]: [...stackAt(board, cell), color] },
  };
}

export function withCard(board: PlayerBoard, cardId: string): PlayerBoard {
  return { ...board, cards: [...board.cards, { cardId, cubesPlaced: 0 }] };
}

function withCube(board: PlayerBoard, placement: CubePlacement): PlayerBoard {
  return {
    ...board,
    cubes: [...board.cubes, hexKey(placement.cell)],
    cards: board.cards.map((owned) =>
      owned.cardId === placement.cardId ? { ...owned, cubesPlaced: owned.cubesPlaced + 1 } : owned,
    ),
  };
}

/**
 * The animal the bot places next, if any. The bot always places an animal as soon as it can,
 * and plans with that same rule, so its plans match what it will actually do.
 */
export function nextCube(context: BotContext, board: PlayerBoard): CubePlacement | null {
  for (const card of cardsInProgress(context, board)) {
    const targets = getCubeTargets(board, card);
    const first = targets[0];
    if (!first) continue;
    if (!context.cubeChooser || targets.length === 1) return { cardId: card.id, cell: first };

    // An animal ends all building on its cell, so prefer the cell that costs the least.
    let best = first;
    let bestValue = -Infinity;
    for (const cell of targets) {
      const value = context.cubeChooser(withCube(board, { cardId: card.id, cell }));
      if (value > bestValue) {
        best = cell;
        bestValue = value;
      }
    }
    return { cardId: card.id, cell: best };
  }
  return null;
}

/** The board once every animal that can be placed has been. */
export function settle(context: BotContext, board: PlayerBoard): PlayerBoard {
  let settled = board;
  for (let cube = nextCube(context, settled); cube; cube = nextCube(context, settled)) {
    settled = withCube(settled, cube);
  }
  return settled;
}
