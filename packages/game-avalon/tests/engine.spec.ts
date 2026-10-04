import { runMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import { AvalonRuleCodes } from '../src/domain/errors.js';
import type { AvalonSettings } from '../src/domain/game-config.js';
import { alignmentOf, type OptionalRole, type Role } from '../src/domain/roles.js';
import type { AvalonState } from '../src/domain/state.js';
import { NO_LEGAL_MOVES } from '../src/rules/legal-moves.js';
import { scriptFullGame, type Policy } from './fixtures/script.js';
import { engine, gameConfig, newGame } from './fixtures/states.js';

const COUNTS = [5, 6, 7, 8, 9, 10] as const;
const SEEDS = ['alpha', 'bravo', 'charlie', 'delta'];
const EVERYTHING: AvalonSettings = {
  roles: ['PERCIVAL', 'MORGANA', 'MORDRED', 'OBERON'],
  ladyOfTheLake: true,
};
const SOME_AT_SEVEN: AvalonSettings = { roles: ['PERCIVAL', 'MORGANA'], ladyOfTheLake: true };

const countRoles = (state: AvalonState, test: (role: Role) => boolean) =>
  state.seatOrder.filter((playerId) => test(state.roles[playerId] as Role)).length;

describe('setup', () => {
  it.each(COUNTS)('deals %i players their roles and waits for the first leader', (count) => {
    const state = newGame({ players: count });
    expect(state.seatOrder).toEqual(seats(count).map((seat) => seat.playerId));
    expect(Object.keys(state.roles).sort()).toEqual([...state.seatOrder].sort());
    expect(countRoles(state, (role) => role === 'MERLIN')).toBe(1);
    expect(countRoles(state, (role) => role === 'ASSASSIN')).toBe(1);
    expect(countRoles(state, (role) => role === 'MINION')).toBe(
      gameConfig.setupByPlayerCount[count].evil - 1,
    );
    expect(countRoles(state, (role) => role === 'LOYAL_SERVANT')).toBe(
      count - gameConfig.setupByPlayerCount[count].evil - 1,
    );

    expect(state.phase).toBe('TEAM_PROPOSAL');
    expect(engine.getGameStatus(state)).toBe('playing');
    expect(engine.getResult(state)).toBeNull();
    expect(engine.getCurrentPlayerIds(state)).toEqual([state.seatOrder[state.firstLeaderIndex]]);
    expect(state.lady).toBeNull();
    expect(state.rules.teamSizes).toEqual(gameConfig.setupByPlayerCount[count].teamSizes);
  });

  it('seats players by seat, whatever order they are given in', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: [...seats(5)].reverse(),
      seed: 'fixture',
      config: gameConfig,
      settings: { roles: [], ladyOfTheLake: false },
    });
    expect(state.seatOrder).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    expect(state).toEqual(newGame());
  });

  it('deals the same game from the same seed, and different ones from different seeds', () => {
    expect(newGame({ seed: 'one', players: 8 })).toEqual(newGame({ seed: 'one', players: 8 }));
    const deals = new Set(
      ['one', 'two', 'three', 'four', 'five', 'six'].map((seed) =>
        JSON.stringify(newGame({ seed, players: 8 }).roles),
      ),
    );
    expect(deals.size).toBeGreaterThan(1);
  });

  it('deals the chosen roles', () => {
    const state = newGame({ players: 10, roles: EVERYTHING.roles, lady: true });
    for (const role of ['MERLIN', 'PERCIVAL', 'ASSASSIN', 'MORGANA', 'MORDRED', 'OBERON']) {
      expect(countRoles(state, (dealt) => dealt === role)).toBe(1);
    }
    expect(countRoles(state, (role) => role === 'MINION')).toBe(0);
    expect(countRoles(state, (role) => role === 'LOYAL_SERVANT')).toBe(4);
    expect(state.lady?.inspections).toEqual([]);
  });

  it.each([4, 11])('refuses %i players', (count) => {
    expect(() => newGame({ players: count })).toThrowError(
      expect.objectContaining({ code: AvalonRuleCodes.InvalidPlayerCount }),
    );
  });

  it.each([
    [5, ['MORGANA', 'MORDRED'], 7],
    [6, ['MORGANA', 'OBERON'], 7],
    [9, ['MORGANA', 'MORDRED', 'OBERON'], 10],
  ] as Array<[number, OptionalRole[], number]>)(
    'refuses %i players when %j are chosen, and says how many it takes',
    (count, roles, needed) => {
      expect(() => newGame({ players: count, roles })).toThrowError(
        expect.objectContaining({
          code: AvalonRuleCodes.RolesDoNotFit,
          message: expect.stringContaining(`at least ${needed} players`),
        }),
      );
      expect(newGame({ players: needed, roles }).phase).toBe('TEAM_PROPOSAL');
    },
  );
});

describe('parseAction', () => {
  it('keeps only the fields an action has', () => {
    expect(engine.parseAction({ type: 'VOTE', proposal: 3, approve: false, as: 'p2' })).toEqual({
      ok: true,
      action: { type: 'VOTE', proposal: 3, approve: false },
    });
    expect(
      engine.parseAction({ type: 'PLAY_QUEST_CARD', quest: 0, success: true, extra: 1 }),
    ).toEqual({ ok: true, action: { type: 'PLAY_QUEST_CARD', quest: 0, success: true } });
    expect(engine.parseAction({ type: 'PROPOSE_TEAM', team: ['p1', 'p2'], x: 1 })).toEqual({
      ok: true,
      action: { type: 'PROPOSE_TEAM', team: ['p1', 'p2'] },
    });
    expect(engine.parseAction({ type: 'USE_LADY', targetId: 'p2', x: 1 })).toEqual({
      ok: true,
      action: { type: 'USE_LADY', targetId: 'p2' },
    });
    expect(engine.parseAction({ type: 'ASSASSINATE', targetId: 'p2', x: 1 })).toEqual({
      ok: true,
      action: { type: 'ASSASSINATE', targetId: 'p2' },
    });
  });

  it.each([
    ['nothing', undefined],
    ['a list', []],
    ['no type', { team: ['p1'] }],
    ['an unknown type', { type: 'RESIGN' }],
    ['a team that is not a list', { type: 'PROPOSE_TEAM', team: 'p1' }],
    ['a team of numbers', { type: 'PROPOSE_TEAM', team: [1, 2] }],
    ['an endless team', { type: 'PROPOSE_TEAM', team: Array.from({ length: 11 }, () => 'p1') }],
    ['a vote without a proposal', { type: 'VOTE', approve: true }],
    ['a vote that is not yes or no', { type: 'VOTE', proposal: 0, approve: 'yes' }],
    ['a vote for a negative proposal', { type: 'VOTE', proposal: -1, approve: true }],
    ['a card without a quest', { type: 'PLAY_QUEST_CARD', success: true }],
    ['a card that is neither', { type: 'PLAY_QUEST_CARD', quest: 0, success: 1 }],
    ['the Lady without a target', { type: 'USE_LADY' }],
    ['an assassination without a target', { type: 'ASSASSINATE', targetId: 4 }],
  ])('rejects %s', (_, raw) => {
    expect(engine.parseAction(raw).ok).toBe(false);
  });
});

describe('full matches', () => {
  const games = COUNTS.flatMap((count) =>
    SEEDS.map((seed, index) => ({
      count,
      seed: `${seed}-${count}`,
      // Every role only fits the largest table; elsewhere alternate the plain game and the Lady.
      settings:
        count === 10 && index % 2 === 0
          ? EVERYTHING
          : { roles: [] as OptionalRole[], ladyOfTheLake: index % 2 === 1 },
    })),
  );

  it.each(games)(
    'replays $count players from seed $seed to the same end, without mutation',
    ({ count, seed, settings }) => {
      const { script, states } = scriptFullGame(seed, count, { settings });
      const run = () =>
        runMatch(engine, { seed, players: seats(count), actions: script, settings });
      expect(run()).toEqual(states.at(-1));
      expect(run()).toEqual(run());
      expect(engine.getGameStatus(run())).toBe('finished');
    },
  );

  it.each(games)('holds its invariants throughout ($count players, $seed)', (game) => {
    const { states } = scriptFullGame(game.seed, game.count, { settings: game.settings });
    for (const state of states) {
      const toMove = engine.getCurrentPlayerIds(state);
      expect(toMove.length > 0).toBe(state.phase !== 'FINISHED');
      for (const playerId of state.seatOrder) {
        const { legal } = engine.getPublicView(state, { type: 'player', playerId });
        expect(JSON.stringify(legal) !== JSON.stringify(NO_LEGAL_MOVES)).toBe(
          toMove.includes(playerId),
        );
      }

      const view = engine.getPublicView(state, { type: 'spectator' });
      expect(view.rejections).toBeLessThanOrEqual(state.rules.maxRejections);
      expect(state.quests.length).toBeLessThanOrEqual(5);
      expect(view.quests).toHaveLength(5);
      expect(view.roles === null).toBe(state.phase !== 'FINISHED');
      expect(view.outcome === null).toBe(state.phase !== 'FINISHED');
      for (const quest of state.quests) {
        for (const playerId of quest.team) {
          if (quest.cards[playerId] === false) {
            expect(alignmentOf(state.roles[playerId] as Role)).toBe('EVIL');
          }
        }
      }
    }
  });

  it('carries on unchanged from a state that went through JSON, as the database stores it', () => {
    const { script, states } = scriptFullGame('json', 7, { settings: SOME_AT_SEVEN });
    const half = Math.floor(script.length / 2);
    let state = JSON.parse(JSON.stringify(states[half])) as AvalonState;
    script.slice(half).forEach((step, index) => {
      state = engine.applyAction(state, step.action, {
        actorPlayerId: step.playerId,
        requestId: `req-${index}`,
        now: '2000-01-01T00:00:00.000Z',
      });
    });
    expect(state).toEqual(states.at(-1));
  });

  const endings: Array<[string, Policy, string]> = [
    ['every team is rejected', { votes: 'reject' }, 'TEAMS_REJECTED'],
    ['evil fails every quest it is on', { votes: 'approve', cards: 'fail' }, 'QUESTS_FAILED'],
  ];

  it.each(endings)('ends for evil when %s', (_, policy, reason) => {
    for (const count of COUNTS) {
      const reasons = SEEDS.map((seed) => {
        const final = scriptFullGame(seed, count, { policy }).states.at(-1) as AvalonState;
        return engine.getPublicView(final, { type: 'spectator' }).outcome?.reason;
      });
      if (reason === 'TEAMS_REJECTED') expect(new Set(reasons)).toEqual(new Set([reason]));
      else expect(reasons).toContain(reason);
    }
  });

  it('ends with the assassination when every quest succeeds', () => {
    const reasons = new Set<string | undefined>();
    for (const count of COUNTS) {
      for (const seed of [...SEEDS, 'echo', 'foxtrot']) {
        const policy: Policy = { votes: 'approve', cards: 'succeed' };
        const final = scriptFullGame(seed, count, { policy }).states.at(-1) as AvalonState;
        expect(final.quests).toHaveLength(3);
        expect(final.assassinTargetId).not.toBeNull();
        const view = engine.getPublicView(final, { type: 'spectator' });
        reasons.add(view.outcome?.reason);

        const side = view.outcome?.winner;
        expect(engine.getResult(final)).toEqual({
          winnerPlayerIds: final.seatOrder.filter(
            (playerId) => alignmentOf(final.roles[playerId] as Role) === side,
          ),
        });
      }
    }
    expect(reasons).toEqual(new Set(['MERLIN_ASSASSINATED', 'MERLIN_SURVIVED']));
  });
});
