import { createSeededRandom } from '@bgp/game-core';
import { deepFreeze, runMatch, seats, type ScriptedAction } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD_CELLS, classifyStack } from '../src/domain/board.js';
import { getCard, getCubeCount } from '../src/domain/cards.js';
import type { HarmoniesState } from '../src/domain/state.js';
import { HarmoniesRuleCodes, type HarmoniesAction } from '../src/index.js';
import { canStack } from '../src/rules/token-placement.rules.js';
import {
  active,
  boardWith,
  cards,
  config,
  context,
  engine,
  newGame,
  withActiveBoard,
} from './fixtures/states.js';

function apply(state: HarmoniesState, action: HarmoniesAction, playerId = active(state)) {
  return deepFreeze(engine.applyAction(state, action, context(playerId)));
}

function expectRejected(
  state: HarmoniesState,
  action: HarmoniesAction,
  code: string,
  playerId = active(state),
) {
  expect(engine.validateAction(state, action, context(playerId))).toMatchObject({
    valid: false,
    code,
  });
  expect(() => engine.applyAction(state, action, context(playerId))).toThrowError(
    expect.objectContaining({ code }),
  );
}

function countTokens(state: HarmoniesState): number {
  const onBoards = Object.values(state.boards).flatMap((board) => Object.values(board.stacks));
  return (
    state.pouch.length +
    state.centralSpaces.flat().length +
    state.turn.hand.length +
    onBoards.flat().length
  );
}

/** Picks a random legal action for the active player, the way a bot would: from its own view. */
function chooseAction(
  state: HarmoniesState,
  random: ReturnType<typeof createSeededRandom>,
): HarmoniesAction {
  const playerId = active(state);
  const { legal, centralSpaces, cardRiver } = engine.getPublicView(state, {
    type: 'player',
    playerId,
  });

  for (const [cardId, cells] of Object.entries(legal.cubeCells)) {
    if (cells.length > 0) return { type: 'PLACE_CUBE', cardId, cell: random.pick(cells) };
  }
  if (legal.canTakeTokens) {
    const options = centralSpaces.flatMap((space, index) => (space.length > 0 ? [index] : []));
    return { type: 'TAKE_TOKENS', spaceIndex: random.pick(options) };
  }
  for (const [color, cells] of Object.entries(legal.tokenCells)) {
    if (cells.length > 0) {
      return {
        type: 'PLACE_TOKEN',
        color: color as keyof typeof legal.tokenCells,
        cell: random.pick(cells),
      };
    }
  }
  if (legal.canTakeCard && random.next() < 0.7) {
    return { type: 'TAKE_CARD', cardId: random.pick(cardRiver).id };
  }
  return { type: 'END_TURN' };
}

function scriptFullGame(seed: string, playerCount: number): ScriptedAction<HarmoniesAction>[] {
  const random = createSeededRandom(`bot-${seed}`);
  const script: ScriptedAction<HarmoniesAction>[] = [];
  let state = engine.createInitialState({ gameId: 'g', players: seats(playerCount), seed, config });
  while (engine.getGameStatus(state) === 'playing') {
    const playerId = active(state);
    const action = chooseAction(state, random);
    script.push({ playerId, action });
    state = engine.applyAction(state, action, context(playerId));
    if (script.length > 5000) throw new Error('game did not terminate');
  }
  return script;
}

describe('setup', () => {
  it('is deterministic for a seed and varies between seeds', () => {
    const input = { gameId: 'g', players: seats(3), seed: 'match-1', config };
    expect(engine.createInitialState(input)).toEqual(engine.createInitialState(input));
    expect(engine.createInitialState({ ...input, seed: 'match-2' }).pouch).not.toEqual(
      engine.createInitialState(input).pouch,
    );
  });

  it('deals 5 spaces of 3 tokens and 5 cards', () => {
    const state = newGame();
    expect(state.centralSpaces.map((space) => space.length)).toEqual([3, 3, 3, 3, 3]);
    expect(state.pouch).toHaveLength(120 - 15);
    expect(state.cardRiver).toHaveLength(5);
    expect(state.cardDeck).toHaveLength(cards.length - 5);
    expect(new Set([...state.cardRiver, ...state.cardDeck]).size).toBe(cards.length);
    expect(state.turnOrder[0]).toBe(state.turn.activePlayerId);
    expect(countTokens(state)).toBe(120);
  });

  it.each([1, 5])('rejects %i players', (count) => {
    expect(() =>
      engine.createInitialState({ gameId: 'g', players: seats(count), seed: 's', config }),
    ).toThrow();
  });
});

describe('turn flow', () => {
  it("rejects another player's action", () => {
    const state = newGame();
    const other = state.turnOrder[1] as string;
    expectRejected(
      state,
      { type: 'TAKE_TOKENS', spaceIndex: 0 },
      HarmoniesRuleCodes.NotYourTurn,
      other,
    );
  });

  it('takes all three tokens from one space, once', () => {
    const state = newGame();
    const taken = apply(state, { type: 'TAKE_TOKENS', spaceIndex: 2 });

    expect(taken.turn.hand).toEqual(state.centralSpaces[2]);
    expect(taken.centralSpaces[2]).toEqual([]);
    expectRejected(
      taken,
      { type: 'TAKE_TOKENS', spaceIndex: 0 },
      HarmoniesRuleCodes.TokensAlreadyTaken,
    );
    expectRejected(state, { type: 'TAKE_TOKENS', spaceIndex: 5 }, HarmoniesRuleCodes.InvalidSpace);
    // The previous state is untouched.
    expect(state.turn.hand).toEqual([]);
  });

  it('places only tokens that are in hand', () => {
    const state = newGame({ centralSpaces: [['water', 'water', 'field'], [], [], [], []] });
    const taken = apply(state, { type: 'TAKE_TOKENS', spaceIndex: 0 });
    expectRejected(
      taken,
      { type: 'PLACE_TOKEN', color: 'mountain', cell: { q: 0, r: 0 } },
      HarmoniesRuleCodes.TokenNotInHand,
    );

    const placed = apply(taken, { type: 'PLACE_TOKEN', color: 'water', cell: { q: 0, r: 0 } });
    expect(placed.turn.hand).toEqual(['water', 'field']);
    expect(placed.boards[active(placed)]?.stacks['0,0']).toEqual(['water']);
  });

  it('cannot end the turn before taking and placing tokens', () => {
    const state = newGame();
    expectRejected(state, { type: 'END_TURN' }, HarmoniesRuleCodes.TokensNotTaken);
    const taken = apply(state, { type: 'TAKE_TOKENS', spaceIndex: 0 });
    expectRejected(taken, { type: 'END_TURN' }, HarmoniesRuleCodes.TokensRemaining);
  });

  it('refills the space and passes the turn', () => {
    let state = newGame({
      centralSpaces: [['water', 'field', 'leaf'], ['field'], ['leaf'], [], []],
    });
    const first = active(state);
    const pouchBefore = state.pouch.length;
    state = apply(state, { type: 'TAKE_TOKENS', spaceIndex: 0 });
    state = apply(state, { type: 'PLACE_TOKEN', color: 'water', cell: { q: 0, r: 0 } });
    state = apply(state, { type: 'PLACE_TOKEN', color: 'field', cell: { q: 0, r: 1 } });
    state = apply(state, { type: 'PLACE_TOKEN', color: 'leaf', cell: { q: 0, r: 2 } });
    state = apply(state, { type: 'END_TURN' });

    expect(active(state)).not.toBe(first);
    expect(state.turn).toMatchObject({ number: 2, tokensTaken: false, hand: [], cardTaken: false });
    // Three empty spaces were refilled; partially filled ones are left alone.
    expect(state.centralSpaces.map((space) => space.length)).toEqual([3, 1, 1, 3, 3]);
    expect(state.pouch).toHaveLength(pouchBefore - 9);
  });

  it('discards tokens that fit nowhere', () => {
    // Every cell is water, so nothing can be stacked anywhere.
    const full = Object.fromEntries(
      DEFAULT_BOARD_CELLS.map((cell) => [`${cell.q},${cell.r}`, ['water' as const]]),
    );
    let state = withActiveBoard(
      newGame({ centralSpaces: [['water', 'field', 'leaf'], [], [], [], []] }),
      boardWith(full),
    );
    state = apply(state, { type: 'TAKE_TOKENS', spaceIndex: 0 });
    expect(engine.validateAction(state, { type: 'END_TURN' }, context(active(state)))).toEqual({
      valid: true,
    });
  });
});

describe('animal cards', () => {
  it('takes one card per turn and refills the row at end of turn', () => {
    const state = newGame();
    const [first, second] = state.cardRiver as [string, string];
    const taken = apply(state, { type: 'TAKE_CARD', cardId: first });

    expect(taken.cardRiver).not.toContain(first);
    expect(taken.boards[active(taken)]?.cards).toEqual([{ cardId: first, cubesPlaced: 0 }]);
    expectRejected(
      taken,
      { type: 'TAKE_CARD', cardId: second },
      HarmoniesRuleCodes.CardAlreadyTaken,
    );
    expectRejected(
      state,
      { type: 'TAKE_CARD', cardId: 'unicorn' },
      HarmoniesRuleCodes.CardNotAvailable,
    );
  });

  it('limits a player to three unfinished cards', () => {
    const state = newGame();
    const river = state.cardRiver[0] as string;
    const others = cards.map((card) => card.id).filter((id) => !state.cardRiver.includes(id));
    const holding = (count: number, done = 0) =>
      withActiveBoard(
        state,
        boardWith(
          {},
          {
            cards: others.slice(0, count).map((cardId, index) => ({
              cardId,
              cubesPlaced: index < done ? getCubeCount(getCard(cards, cardId)) : 0,
            })),
          },
        ),
      );

    expectRejected(
      holding(3),
      { type: 'TAKE_CARD', cardId: river },
      HarmoniesRuleCodes.TooManyCards,
    );
    // A completed card frees its slot.
    expect(
      engine.validateAction(
        holding(3, 1),
        { type: 'TAKE_CARD', cardId: river },
        context(active(state)),
      ),
    ).toEqual({
      valid: true,
    });
  });

  it('places a cube on a matching habitat and scores it', () => {
    const state = withActiveBoard(
      newGame(),
      boardWith(
        { '2,1': ['water'], '3,1': ['leaf'] },
        { cards: [{ cardId: 'animal-05', cubesPlaced: 0 }] },
      ),
    );
    const me = active(state);
    const cube = { type: 'PLACE_CUBE', cardId: 'animal-05', cell: { q: 2, r: 1 } } as const;

    expectRejected(state, { ...cube, cell: { q: 3, r: 1 } }, HarmoniesRuleCodes.HabitatNotMatched);
    expectRejected(state, { ...cube, cardId: 'animal-04' }, HarmoniesRuleCodes.CardNotOwned);

    const placed = apply(state, cube);
    expect(placed.boards[me]?.cubes).toEqual(['2,1']);
    expect(placed.boards[me]?.cards).toEqual([{ cardId: 'animal-05', cubesPlaced: 1 }]);
    expect(engine.getPublicView(placed, { type: 'spectator' }).scores[me]?.animals).toBe(2);

    // The same cell cannot take a second animal, and cannot be built on.
    expectRejected(placed, cube, HarmoniesRuleCodes.CellHasCube);
  });

  it('refuses cubes from a completed card', () => {
    const state = withActiveBoard(
      newGame(),
      boardWith(
        { '2,1': ['water'], '3,1': ['leaf'] },
        { cards: [{ cardId: 'animal-05', cubesPlaced: 5 }] },
      ),
    );
    expectRejected(
      state,
      { type: 'PLACE_CUBE', cardId: 'animal-05', cell: { q: 2, r: 1 } },
      HarmoniesRuleCodes.CardCompleted,
    );
  });
});

describe('end of game', () => {
  const nearlyFull = () =>
    Object.fromEntries(
      DEFAULT_BOARD_CELLS.slice(0, 21).map((cell) => [`${cell.q},${cell.r}`, ['water' as const]]),
    );

  it('lets everyone finish the round once a board is nearly full', () => {
    let state = withActiveBoard(newGame(), boardWith(nearlyFull()));
    const [first, second] = state.turnOrder as [string, string];
    state = apply(state, { type: 'TAKE_TOKENS', spaceIndex: 0 });
    for (const color of [...state.turn.hand]) {
      const cell = engine.getPublicView(state, { type: 'player', playerId: first }).legal
        .tokenCells[color]?.[0];
      if (cell) state = apply(state, { type: 'PLACE_TOKEN', color, cell });
    }
    state = apply(state, { type: 'END_TURN' });

    expect(state.finalRound).toBe(true);
    expect(engine.getGameStatus(state)).toBe('playing');
    expect(active(state)).toBe(second);

    state = apply(state, { type: 'TAKE_TOKENS', spaceIndex: 1 });
    for (const color of [...state.turn.hand]) {
      const cell = engine.getPublicView(state, { type: 'player', playerId: second }).legal
        .tokenCells[color]?.[0];
      if (cell) state = apply(state, { type: 'PLACE_TOKEN', color, cell });
    }
    state = apply(state, { type: 'END_TURN' });

    expect(engine.getGameStatus(state)).toBe('finished');
    expect(engine.getCurrentPlayerIds(state)).toEqual([]);
    expect(state.winnerPlayerIds.length).toBeGreaterThan(0);
    expectRejected(state, { type: 'END_TURN' }, HarmoniesRuleCodes.GameNotPlaying, first);
  });

  it('starts the final round when the pouch cannot refill a space', () => {
    let state = newGame({
      pouch: ['water', 'field'],
      centralSpaces: [['water'], ['field'], [], [], []],
    });
    state = apply(state, { type: 'TAKE_TOKENS', spaceIndex: 0 });
    state = apply(state, { type: 'PLACE_TOKEN', color: 'water', cell: { q: 0, r: 0 } });
    state = apply(state, { type: 'END_TURN' });
    expect(state.finalRound).toBe(true);
    expect(engine.getGameStatus(state)).toBe('playing');
  });

  it('breaks a tie on animal cubes', () => {
    const base = newGame();
    const [first, second] = base.turnOrder as [string, string];
    const state = deepFreeze({
      ...base,
      finalRound: true,
      turn: { ...base.turn, activePlayerId: second, tokensTaken: true },
      boards: {
        // 7 points each (5 of them for the one island): two small trees against one animal.
        [first]: boardWith({ '0,0': ['leaf'], '4,0': ['leaf'] }),
        [second]: boardWith(
          {},
          { cards: [{ cardId: 'animal-05', cubesPlaced: 1 }], cubes: ['0,0'] },
        ),
      },
    });
    const finished = apply(state, { type: 'END_TURN' }, second);
    expect(engine.getResult(finished)).toEqual({
      winnerPlayerIds: [second],
      scores: { [first]: 7, [second]: 7 },
    });
  });
});

describe('public view', () => {
  it('never exposes the pouch or deck order', () => {
    const state = newGame();
    for (const viewer of [
      { type: 'player', playerId: state.turnOrder[0] as string },
      { type: 'spectator' },
    ] as const) {
      const view = engine.getPublicView(state, viewer) as unknown as Record<string, unknown>;
      expect(view).not.toHaveProperty('pouch');
      expect(view).not.toHaveProperty('cardDeck');
      expect(view.pouchCount).toBe(state.pouch.length);
      expect(view.cardDeckCount).toBe(state.cardDeck.length);
    }
  });

  it('only offers moves to the active player', () => {
    const state = newGame();
    const [first, second] = state.turnOrder as [string, string];
    expect(
      engine.getPublicView(state, { type: 'player', playerId: first }).legal.canTakeTokens,
    ).toBe(true);
    expect(
      engine.getPublicView(state, { type: 'player', playerId: second }).legal.canTakeTokens,
    ).toBe(false);
    expect(engine.getPublicView(state, { type: 'spectator' }).legal.canTakeTokens).toBe(false);
  });
});

describe('full matches', () => {
  const games: Array<[string, number]> = [
    ['alpha', 2],
    ['beta', 2],
    ['gamma', 3],
    ['delta', 4],
  ];

  it.each(games)('replays identically from seed + actions (%s, %i players)', (seed, players) => {
    const actions = scriptFullGame(seed, players);
    const first = runMatch(engine, { seed, players: seats(players), actions });
    const second = runMatch(engine, { seed, players: seats(players), actions });

    expect(first).toEqual(second);
    expect(engine.getGameStatus(first)).toBe('finished');
    expect(first.winnerPlayerIds.length).toBeGreaterThan(0);
  });

  it.each(games)('keeps invariants on every step (%s, %i players)', (seed, players) => {
    let state = engine.createInitialState({ gameId: 'g', players: seats(players), seed, config });
    let tokens = countTokens(state);
    const turnsTaken = new Map<string, number>();

    for (const step of scriptFullGame(seed, players)) {
      expect(state.turnOrder).toContain(active(state));
      const next = engine.applyAction(state, step.action, context(step.playerId));
      if (step.action.type === 'END_TURN') {
        turnsTaken.set(step.playerId, (turnsTaken.get(step.playerId) ?? 0) + 1);
      }

      // Tokens are never created; they only leave play when discarded at end of turn.
      const nextTokens = countTokens(next);
      if (step.action.type === 'END_TURN') expect(nextTokens).toBeLessThanOrEqual(tokens);
      else expect(nextTokens).toBe(tokens);
      tokens = nextTokens;

      for (const board of Object.values(next.boards)) {
        // Every stack could have been built legally, one token at a time.
        for (const stack of Object.values(board.stacks)) {
          stack.forEach((color, height) =>
            expect(canStack(stack.slice(0, height), color)).toBe(true),
          );
        }
        // One animal per cell, each on a finished terrain, and never more than a card allows.
        expect(new Set(board.cubes).size).toBe(board.cubes.length);
        for (const key of board.cubes)
          expect(classifyStack(board.stacks[key] ?? [])).not.toBeNull();
        for (const card of board.cards) {
          expect(card.cubesPlaced).toBeLessThanOrEqual(getCubeCount(getCard(cards, card.cardId)));
        }
        expect(board.cubes).toHaveLength(
          board.cards.reduce((sum, card) => sum + card.cubesPlaced, 0),
        );
      }
      for (const score of Object.values(engine.getPublicView(next, { type: 'spectator' }).scores)) {
        expect(Number.isFinite(score.total)).toBe(true);
      }
      expect(next.turn.number).toBeGreaterThanOrEqual(state.turn.number);
      state = next;
    }

    // Everyone had the same number of turns.
    expect(new Set(state.turnOrder.map((playerId) => turnsTaken.get(playerId))).size).toBe(1);
  });
});
