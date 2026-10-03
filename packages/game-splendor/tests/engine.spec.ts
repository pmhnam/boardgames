import { deepFreeze, runMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { SplendorAction } from '../src/domain/actions.js';
import { SplendorRuleCodes } from '../src/domain/errors.js';
import { GEM_COLORS, TOKEN_COLORS, countTokens } from '../src/domain/gems.js';
import type { SplendorState } from '../src/domain/state.js';
import { listLegalActions } from '../src/rules/legal-moves.js';
import { scriptFullGame } from './fixtures/script.js';
import {
  active,
  apply,
  cards,
  context,
  engine,
  expectRejected,
  gameConfig,
  newGame,
  other,
  tokens,
  validate,
  withPlayer,
  withPurchased,
} from './fixtures/states.js';

const TAKE: SplendorAction = { type: 'TAKE_GEMS', colors: ['white', 'blue', 'green'] };

describe('setup', () => {
  it.each([
    [2, 4, 3],
    [3, 5, 4],
    [4, 7, 5],
  ])('lays the table out for %i players', (players, gemsPerColor, nobles) => {
    const state = newGame({}, { players });

    for (const color of GEM_COLORS) expect(state.bank[color]).toBe(gemsPerColor);
    expect(state.bank.gold).toBe(5);
    expect(state.nobles).toHaveLength(nobles);
    expect(state.config.nobles.map((noble) => noble.id)).toEqual(state.nobles);
    expect([state.decks[1].length, state.decks[2].length, state.decks[3].length]).toEqual([
      36, 26, 16,
    ]);
    for (const tier of [1, 2, 3] as const) {
      expect(state.market[tier]).toHaveLength(4);
      expect(state.market[tier].every((cardId) => cardId !== null)).toBe(true);
    }
    expect(Object.keys(state.players).sort()).toEqual([...state.turnOrder].sort());
    expect(state.turn).toEqual({ number: 1, activePlayerId: state.turnOrder[0], step: 'ACTION' });
  });

  it('is decided by the seed alone', () => {
    expect(newGame({}, { seed: 'a' })).toEqual(newGame({}, { seed: 'a' }));
    expect(newGame({}, { seed: 'a' }).decks).not.toEqual(newGame({}, { seed: 'b' }).decks);
  });

  it('takes the target score from the room settings', () => {
    expect(newGame({}, { targetScore: 10 }).config.targetScore).toBe(10);
    expect(newGame().config.targetScore).toBe(15);
  });

  it.each([1, 5])('refuses %i players', (players) => {
    expect(() =>
      engine.createInitialState({
        gameId: 'g',
        players: seats(players),
        seed: 's',
        config: gameConfig,
        settings: { targetScore: 15 },
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_PLAYER_COUNT' }));
  });
});

describe('turn order', () => {
  it('refuses a move out of turn', () => {
    const state = newGame();
    expectRejected(state, TAKE, SplendorRuleCodes.NotYourTurn, other(state));
  });

  it('refuses a move once the game is over', () => {
    const state = newGame({ phase: 'FINISHED' });
    expectRejected(state, TAKE, SplendorRuleCodes.GameNotPlaying);
    expect(engine.getCurrentPlayerIds(state)).toEqual([]);
  });

  it('holds every main action back while tokens are owed', () => {
    const base = newGame();
    const state = withPlayer(
      { ...base, turn: { ...base.turn, step: 'RETURN_GEMS' } },
      active(base),
      { tokens: tokens({ white: 4, blue: 4, green: 3 }) },
    );
    const cardId = state.market[1][0] as string;
    const blocked: SplendorAction[] = [
      TAKE,
      { type: 'RESERVE_CARD', cardId },
      { type: 'RESERVE_FROM_DECK', tier: 1 },
      { type: 'BUY_CARD', cardId },
      { type: 'CHOOSE_NOBLE', nobleId: state.nobles[0] as string },
      { type: 'PASS' },
    ];
    for (const action of blocked) expectRejected(state, action, SplendorRuleCodes.WrongStep);
  });
});

describe('passing', () => {
  /** Nobody can take, reserve or buy: the bank is empty and every reserve is full. */
  function deadlocked(): SplendorState {
    const base = newGame({ bank: tokens() });
    const fill = (deck: string[], from: number) =>
      deck.slice(from, from + 3).map((cardId) => ({ cardId, blind: true }));
    const [first, second] = base.turnOrder as [string, string];
    const state = {
      ...base,
      decks: { ...base.decks, 3: base.decks[3].slice(6) },
    };
    return withPlayer(withPlayer(state, first, { reserved: fill(base.decks[3], 0) }), second, {
      reserved: fill(base.decks[3], 3),
    });
  }

  it('is refused while the bank has gems', () => {
    const state = deepFreeze({ ...deadlocked(), bank: tokens({ red: 1 }) });
    expectRejected(state, { type: 'PASS' }, SplendorRuleCodes.PassNotAllowed);
  });

  it('is refused while a card can be reserved', () => {
    const state = withPlayer(deadlocked(), active(deadlocked()), { reserved: [] });
    expectRejected(state, { type: 'PASS' }, SplendorRuleCodes.PassNotAllowed);
  });

  it('is refused while a card can be bought', () => {
    const state = withPlayer(deadlocked(), active(deadlocked()), {
      tokens: tokens({ gold: 8 }),
    });
    expect(
      engine.getPublicView(state, { type: 'player', playerId: active(state) }).legal.buyable,
    ).not.toEqual([]);
    expectRejected(state, { type: 'PASS' }, SplendorRuleCodes.PassNotAllowed);
  });

  it('is the only move left in a deadlock, and a round of it ends the game', () => {
    const state = deadlocked();
    const playerId = active(state);
    const view = engine.getPublicView(state, { type: 'player', playerId });
    expect(listLegalActions(view.legal, state.players[playerId]!.tokens)).toEqual([
      { type: 'PASS' },
    ]);

    const once = apply(state, { type: 'PASS' });
    expect(once.phase).toBe('PLAYING');
    expect(once.passStreak).toBe(1);

    const twice = apply(once, { type: 'PASS' });
    expect(twice.phase).toBe('FINISHED');
    expect([...twice.winnerPlayerIds].sort()).toEqual([...state.turnOrder].sort());
  });

  it('only counts consecutive passes', () => {
    const state = deadlocked();
    const second = other(state);
    const once = apply(state, { type: 'PASS' });
    // The other player is not stuck after all: they can pay for a face-up card.
    const able = withPlayer(once, second, { tokens: tokens({ gold: 8 }) });
    const cardId = engine.getPublicView(able, { type: 'player', playerId: second }).legal
      .buyable[0] as string;

    const bought = apply(able, { type: 'BUY_CARD', cardId });
    expect(bought.passStreak).toBe(0);
    expect(bought.phase).toBe('PLAYING');
  });
});

describe('end of the game', () => {
  const FIFTEEN = ['white-L3-04', 'blue-L3-04', 'green-L3-04']; // 5 + 5 + 5
  const EIGHTEEN = ['red-L3-04', 'black-L3-04', 'white-L3-01', 'blue-L3-01']; // 5 + 5 + 4 + 4
  const FIFTEEN_IN_FOUR = ['red-L3-04', 'white-L3-01', 'blue-L3-03', 'green-L3-03']; // 5 + 4 + 3 + 3

  it('lets the round finish after a player reaches the target', () => {
    const base = newGame();
    const [first, second] = base.turnOrder as [string, string];
    const state = withPurchased(base, first, FIFTEEN);

    const triggered = apply(state, TAKE);
    expect(triggered.finalRound).toBe(true);
    expect(triggered.phase).toBe('PLAYING');
    expect(engine.getResult(triggered)).toBeNull();
    expect(active(triggered)).toBe(second);

    const done = apply(triggered, { type: 'TAKE_GEMS', colors: ['red', 'black', 'green'] });
    expect(done.phase).toBe('FINISHED');
    expect(done.winnerPlayerIds).toEqual([first]);
    expect(engine.getGameStatus(done)).toBe('finished');
    expect(engine.getResult(done)).toEqual({
      winnerPlayerIds: [first],
      scores: { [first]: 15, [second]: 0 },
    });
  });

  it('ends at once when the last player of the round reaches the target', () => {
    const base = newGame();
    const [first, second] = base.turnOrder as [string, string];
    const state = withPurchased(
      { ...base, turn: { number: 2, activePlayerId: second, step: 'ACTION' } },
      second,
      FIFTEEN,
    );

    const done = apply(state, TAKE);
    expect(done.phase).toBe('FINISHED');
    expect(done.winnerPlayerIds).toEqual([second]);
    expect(done.players[first]?.purchased).toEqual([]);
  });

  it('does not end below the target', () => {
    const base = newGame();
    const state = withPurchased(base, active(base), ['white-L3-04', 'blue-L3-04', 'green-L3-01']);
    const next = apply(apply(state, TAKE), {
      type: 'TAKE_GEMS',
      colors: ['red', 'black', 'green'],
    });
    expect(next.finalRound).toBe(false);
    expect(next.phase).toBe('PLAYING');
  });

  it('gives the win to whoever is ahead when the round ends, not who triggered it', () => {
    const base = newGame();
    const [first, second] = base.turnOrder as [string, string];
    const state = withPurchased(withPurchased(base, first, FIFTEEN), second, EIGHTEEN);

    const done = apply(apply(state, TAKE), {
      type: 'TAKE_GEMS',
      colors: ['red', 'black', 'green'],
    });
    expect(done.winnerPlayerIds).toEqual([second]);
  });

  it('breaks a tie in favour of fewer purchased cards', () => {
    const base = newGame();
    const [first, second] = base.turnOrder as [string, string];
    const state = withPurchased(withPurchased(base, first, FIFTEEN_IN_FOUR), second, FIFTEEN);

    const done = apply(apply(state, TAKE), {
      type: 'TAKE_GEMS',
      colors: ['red', 'black', 'green'],
    });
    expect(done.winnerPlayerIds).toEqual([second]);
  });

  it('shares the win when points and cards are level', () => {
    const base = newGame({}, { targetScore: 10 });
    const [first, second] = base.turnOrder as [string, string];
    const state = withPurchased(withPurchased(base, first, ['white-L3-04', 'blue-L3-04']), second, [
      'red-L3-04',
      'black-L3-04',
    ]);

    const done = apply(apply(state, TAKE), {
      type: 'TAKE_GEMS',
      colors: ['red', 'black', 'green'],
    });
    expect(done.winnerPlayerIds).toEqual([first, second]);
  });
});

describe('full matches', () => {
  const games: Array<[string, number]> = [
    ['alpha', 2],
    ['bravo', 2],
    ['charlie', 3],
    ['delta', 3],
    ['echo', 4],
    ['foxtrot', 4],
  ];

  /** Every action a client could send, so the validator can be checked against `legal`. */
  const universe: SplendorAction[] = [
    ...GEM_COLORS.flatMap((a, i) => [
      { type: 'TAKE_GEMS' as const, colors: [a] },
      { type: 'TAKE_GEMS' as const, colors: [a, a] },
      ...GEM_COLORS.slice(i + 1).flatMap((b, j) => [
        { type: 'TAKE_GEMS' as const, colors: [a, b] },
        ...GEM_COLORS.slice(i + j + 2).map((c) => ({
          type: 'TAKE_GEMS' as const,
          colors: [a, b, c],
        })),
      ]),
    ]),
    ...cards.flatMap((card) => [
      { type: 'BUY_CARD' as const, cardId: card.id },
      { type: 'RESERVE_CARD' as const, cardId: card.id },
    ]),
    ...([1, 2, 3] as const).map((tier) => ({ type: 'RESERVE_FROM_DECK' as const, tier })),
    ...gameConfig.nobles.map((noble) => ({ type: 'CHOOSE_NOBLE' as const, nobleId: noble.id })),
    { type: 'PASS' },
  ];

  it.each(games)('replays %s (%i players) to the same end', (seed, players) => {
    const actions = scriptFullGame(seed, players);
    const run = () => runMatch(engine, { seed, players: seats(players), actions });

    const final = run();
    expect(final).toEqual(run());
    expect(final.phase).toBe('FINISHED');
    expect(final.winnerPlayerIds.length).toBeGreaterThan(0);
  });

  it.each(games)('keeps %s (%i players) consistent after every action', (seed, players) => {
    const actions = scriptFullGame(seed, players);
    let state = newGame({}, { seed, players });
    const supply = { ...state.bank };
    const allCards = cards.map((card) => card.id).sort();
    const dealtNobles = [...state.nobles].sort();

    for (const step of actions) {
      const before = state;
      // What the view calls legal is exactly what the validator accepts.
      const view = engine.getPublicView(before, { type: 'player', playerId: step.playerId });
      const legal = listLegalActions(view.legal, before.players[step.playerId]!.tokens);
      const listed = new Set(legal.map((action) => JSON.stringify(action)));
      for (const action of legal) expect(validate(before, action).valid).toBe(true);
      for (const action of universe) {
        expect(validate(before, action).valid).toBe(listed.has(JSON.stringify(action)));
      }

      state = deepFreeze(engine.applyAction(before, step.action, context(step.playerId)));
      const seated = state.turnOrder.map((playerId) => state.players[playerId]!);

      // Tokens only move between the bank and the players.
      for (const color of TOKEN_COLORS) {
        const held = seated.reduce((sum, player) => sum + player.tokens[color], 0);
        expect(state.bank[color] + held).toBe(supply[color]);
        expect(state.bank[color]).toBeGreaterThanOrEqual(0);
      }
      // Every card is in exactly one place.
      const everywhere = [
        ...([1, 2, 3] as const).flatMap((tier) => [
          ...state.decks[tier],
          ...state.market[tier].filter((cardId) => cardId !== null),
        ]),
        ...seated.flatMap((player) => [
          ...player.purchased,
          ...player.reserved.map((entry) => entry.cardId),
        ]),
      ];
      expect(everywhere.sort()).toEqual(allCards);
      // A market slot is only empty once its deck is.
      for (const tier of [1, 2, 3] as const) {
        if (state.market[tier].includes(null)) expect(state.decks[tier]).toEqual([]);
      }
      // So is every noble.
      expect([...state.nobles, ...seated.flatMap((player) => player.nobles)].sort()).toEqual(
        dealtNobles,
      );

      for (const player of seated) expect(player.reserved.length).toBeLessThanOrEqual(3);
      // Whoever just finished a turn is within the token limit.
      if (state.turn.number !== before.turn.number) {
        expect(countTokens(state.players[step.playerId]!.tokens)).toBeLessThanOrEqual(10);
        expect(state.turn.number).toBe(before.turn.number + 1);
        expect(state.turn.step).toBe('ACTION');
      }
      expect(state.turnOrder).toContain(state.turn.activePlayerId);
      for (const score of Object.values(
        engine.getPublicView(state, { type: 'spectator' }).players,
      )) {
        expect(Number.isFinite(score.points)).toBe(true);
      }
    }

    // Everyone had the same number of turns, and somebody got to the target.
    expect(state.phase).toBe('FINISHED');
    expect(state.turn.number % players).toBe(0);
    const scores = engine.getResult(state)?.scores ?? {};
    expect(Math.max(...Object.values(scores))).toBeGreaterThanOrEqual(15);
  });

  it('carries on identically after the state has been through JSON', () => {
    const actions = scriptFullGame('json', 3);
    const half = Math.floor(actions.length / 2);
    const players = seats(3);
    const midway = runMatch(engine, { seed: 'json', players, actions: actions.slice(0, half) });

    let state = JSON.parse(JSON.stringify(midway)) as SplendorState;
    expect(state).toEqual(midway);
    for (const step of actions.slice(half)) {
      state = engine.applyAction(state, step.action, context(step.playerId));
    }
    expect(state).toEqual(runMatch(engine, { seed: 'json', players, actions }));
  });
});
