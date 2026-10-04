import { runMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import { AvalonRuleCodes } from '../src/domain/errors.js';
import { getRolesInPlay, minPlayersFor, type AvalonConfig } from '../src/domain/game-config.js';
import type { OptionalRole } from '../src/domain/roles.js';
import { scriptFullGame } from './fixtures/script.js';
import { engine, gameConfig } from './fixtures/states.js';

const defaults = (): AvalonConfig => JSON.parse(JSON.stringify(gameConfig)) as AvalonConfig;

function withConfig(patch: Record<string, unknown>): unknown {
  return { ...defaults(), ...patch };
}

function withSetup(patch: Record<string, unknown>): unknown {
  const config = defaults();
  return {
    ...config,
    setupByPlayerCount: {
      ...config.setupByPlayerCount,
      5: { ...config.setupByPlayerCount[5], ...patch },
    },
  };
}

describe('the default table', () => {
  it.each([
    [5, 2, [2, 3, 2, 3, 3], [1, 1, 1, 1, 1]],
    [6, 2, [2, 3, 4, 3, 4], [1, 1, 1, 1, 1]],
    [7, 3, [2, 3, 3, 4, 4], [1, 1, 1, 2, 1]],
    [8, 3, [3, 4, 4, 5, 5], [1, 1, 1, 2, 1]],
    [9, 3, [3, 4, 4, 5, 5], [1, 1, 1, 2, 1]],
    [10, 4, [3, 4, 4, 5, 5], [1, 1, 1, 2, 1]],
  ] as const)('seats %i players with %i evil', (count, evil, teamSizes, failsRequired) => {
    expect(gameConfig.setupByPlayerCount[count]).toEqual({ evil, teamSizes, failsRequired });
  });

  it('gives evil five rejections and uses the Lady after quests two, three and four', () => {
    expect(gameConfig.maxRejections).toBe(5);
    expect(gameConfig.ladyAfterQuests).toEqual([2, 3, 4]);
    expect(gameConfig.optionalRoles).toEqual(['PERCIVAL', 'MORGANA', 'MORDRED', 'OBERON']);
  });
});

describe('parseConfig', () => {
  it('accepts the default config unchanged', () => {
    expect(engine.parseConfig(gameConfig)).toEqual({ ok: true, config: gameConfig });
  });

  it('accepts the default after a trip through JSON, as the database stores it', () => {
    expect(engine.parseConfig(defaults())).toEqual({ ok: true, config: gameConfig });
  });

  it('drops fields it does not know', () => {
    const parsed = engine.parseConfig({ ...defaults(), extra: true });
    expect(parsed).toEqual({ ok: true, config: gameConfig });
  });

  it('puts the Lady’s quests and the roles on offer in order', () => {
    const parsed = engine.parseConfig(
      withConfig({ ladyAfterQuests: [4, 2], optionalRoles: ['OBERON', 'PERCIVAL'] }),
    );
    expect(parsed).toMatchObject({
      ok: true,
      config: { ladyAfterQuests: [2, 4], optionalRoles: ['PERCIVAL', 'OBERON'] },
    });
  });

  const invalid: Array<[string, unknown]> = [
    ['something that is not an object', 'avalon'],
    ['no table of setups', withConfig({ setupByPlayerCount: undefined })],
    ['a missing player count', withConfig({ setupByPlayerCount: { 5: {} } })],
    ['no evil players', withSetup({ evil: 0 })],
    ['nobody left to be Merlin', withSetup({ evil: 5 })],
    ['a fractional number of evil players', withSetup({ evil: 1.5 })],
    ['too few quests', withSetup({ teamSizes: [2, 3, 2, 3] })],
    ['too many quests', withSetup({ teamSizes: [2, 3, 2, 3, 3, 3] })],
    ['an empty team', withSetup({ teamSizes: [0, 3, 2, 3, 3] })],
    ['a team larger than the table', withSetup({ teamSizes: [6, 3, 2, 3, 3] })],
    ['fails listed for too few quests', withSetup({ failsRequired: [1, 1, 1, 1] })],
    ['a quest that cannot fail', withSetup({ failsRequired: [0, 1, 1, 1, 1] })],
    ['more fails than team members', withSetup({ failsRequired: [3, 1, 1, 1, 1] })],
    ['no rejections allowed', withConfig({ maxRejections: 0 })],
    ['an endless run of rejections', withConfig({ maxRejections: 1000 })],
    ['the Lady after the last quest', withConfig({ ladyAfterQuests: [5] })],
    ['the Lady after a quest twice', withConfig({ ladyAfterQuests: [2, 2] })],
    ['the Lady after no quest in particular', withConfig({ ladyAfterQuests: 'all' })],
    ['a role that is not optional', withConfig({ optionalRoles: ['MERLIN'] })],
    ['an unknown role', withConfig({ optionalRoles: ['LANCELOT'] })],
  ];

  it.each(invalid)('rejects %s', (_, raw) => {
    const parsed = engine.parseConfig(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).not.toBe('');
  });
});

describe('parseSettings', () => {
  it('defaults to the plain game', () => {
    const plain = { ok: true, settings: { roles: [], ladyOfTheLake: false } };
    expect(engine.parseSettings(undefined, gameConfig)).toEqual(plain);
    expect(engine.parseSettings(null, gameConfig)).toEqual(plain);
    expect(engine.parseSettings({}, gameConfig)).toEqual(plain);
  });

  it('keeps the chosen roles once each, in a fixed order, and drops unknown fields', () => {
    const raw = { roles: ['OBERON', 'PERCIVAL', 'OBERON'], ladyOfTheLake: true, extra: 1 };
    expect(engine.parseSettings(raw, gameConfig)).toEqual({
      ok: true,
      settings: { roles: ['PERCIVAL', 'OBERON'], ladyOfTheLake: true },
    });
  });

  it.each([
    ['a list', ['PERCIVAL']],
    ['text', 'PERCIVAL'],
    ['roles that are not a list', { roles: 'PERCIVAL' }],
    ['a role that is always in play', { roles: ['MERLIN'] }],
    ['an unknown role', { roles: ['LANCELOT'] }],
    ['a Lady that is neither on nor off', { ladyOfTheLake: 'yes' }],
  ])('rejects %s', (_, raw) => {
    expect(engine.parseSettings(raw, gameConfig).ok).toBe(false);
  });

  it('only offers the roles the config does', () => {
    const config = { ...defaults(), optionalRoles: ['PERCIVAL'] as OptionalRole[] };
    expect(engine.parseSettings({ roles: ['PERCIVAL'] }, config).ok).toBe(true);
    expect(engine.parseSettings({ roles: ['MORGANA'] }, config).ok).toBe(false);
  });
});

describe('fitting roles to the table', () => {
  it('fills the seats with Loyal Servants and Minions', () => {
    expect(getRolesInPlay(5, [], gameConfig)).toEqual([
      'MERLIN',
      'LOYAL_SERVANT',
      'LOYAL_SERVANT',
      'ASSASSIN',
      'MINION',
    ]);
    expect(getRolesInPlay(7, ['PERCIVAL', 'MORGANA', 'OBERON'], gameConfig)).toEqual([
      'MERLIN',
      'PERCIVAL',
      'LOYAL_SERVANT',
      'LOYAL_SERVANT',
      'ASSASSIN',
      'MORGANA',
      'OBERON',
    ]);
  });

  it.each([
    [[], 5],
    [['PERCIVAL'], 5],
    [['PERCIVAL', 'MORGANA'], 5],
    [['MORGANA', 'MORDRED'], 7],
    [['MORDRED', 'OBERON'], 7],
    [['PERCIVAL', 'MORGANA', 'MORDRED', 'OBERON'], 10],
  ] as Array<[OptionalRole[], number]>)('%j needs %i players', (roles, players) => {
    expect(minPlayersFor(roles, gameConfig)).toBe(players);
    expect(getRolesInPlay(players, roles, gameConfig)).toHaveLength(players);
    if (players > 5) expect(getRolesInPlay(players - 1, roles, gameConfig)).toBeNull();
  });

  it('knows when the roles fit no table', () => {
    const config = defaults();
    config.setupByPlayerCount[10].evil = 1;
    expect(minPlayersFor(['MORGANA', 'MORDRED', 'OBERON'], gameConfig)).toBe(10);
    expect(minPlayersFor(['MORGANA', 'MORDRED', 'OBERON'], config)).toBeNull();
  });
});

describe('validateSetup', () => {
  const check = (playerCount: number, roles: OptionalRole[]) =>
    engine.validateSetup({
      config: gameConfig,
      settings: { roles, ladyOfTheLake: true },
      playerCount,
    });

  it('accepts the plain game at every table', () => {
    for (const playerCount of [5, 6, 7, 8, 9, 10]) {
      expect(check(playerCount, [])).toEqual({ valid: true });
    }
  });

  it.each([
    [5, ['MORGANA', 'MORDRED'], 7],
    [6, ['MORDRED', 'OBERON'], 7],
    [9, ['MORGANA', 'MORDRED', 'OBERON'], 10],
  ] as Array<[number, OptionalRole[], number]>)(
    'refuses %i players for %j, and says how many it takes',
    (playerCount, roles, needed) => {
      expect(check(playerCount, roles)).toEqual({
        valid: false,
        code: AvalonRuleCodes.RolesDoNotFit,
        message: expect.stringContaining(`at least ${needed} players`),
      });
      expect(check(needed, roles)).toEqual({ valid: true });
    },
  );

  it.each([4, 11])('refuses a table of %i', (playerCount) => {
    expect(check(playerCount, [])).toMatchObject({
      valid: false,
      code: AvalonRuleCodes.InvalidPlayerCount,
    });
  });

  it('agrees with the setup itself', () => {
    const settings = { roles: ['MORGANA', 'MORDRED'] as OptionalRole[], ladyOfTheLake: false };
    const create = () =>
      engine.createInitialState({
        gameId: 'g',
        players: seats(5),
        seed: 's',
        config: gameConfig,
        settings,
      });
    expect(create).toThrowError(expect.objectContaining({ code: AvalonRuleCodes.RolesDoNotFit }));
  });
});

describe('a custom config', () => {
  /** One evil player, a single rejection allowed, and the Lady only after the first quest. */
  const custom: AvalonConfig = {
    ...defaults(),
    setupByPlayerCount: {
      ...defaults().setupByPlayerCount,
      5: { evil: 1, teamSizes: [1, 1, 5, 5, 5], failsRequired: [1, 1, 1, 1, 1] },
    },
    maxRejections: 1,
    ladyAfterQuests: [1],
  };

  it('is accepted', () => {
    expect(engine.parseConfig(custom)).toEqual({ ok: true, config: custom });
  });

  it('sets the match up by its own table', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: seats(5),
      seed: 'custom',
      config: custom,
      settings: { roles: [], ladyOfTheLake: true },
    });
    expect(state.rules).toEqual({
      teamSizes: [1, 1, 5, 5, 5],
      failsRequired: [1, 1, 1, 1, 1],
      maxRejections: 1,
      ladyAfterQuests: [1],
    });
    expect(Object.values(state.roles).filter((role) => role === 'ASSASSIN')).toHaveLength(1);
    expect(Object.values(state.roles).filter((role) => role === 'MINION')).toHaveLength(0);
  });

  it.each(['a', 'b', 'c', 'd', 'e', 'f'])('is played by to the end (seed %s)', (seed) => {
    const settings = { roles: [], ladyOfTheLake: true };
    const { script, states } = scriptFullGame(seed, 5, { config: custom, settings });
    const final = runMatch(engine, {
      seed,
      players: seats(5),
      actions: script,
      config: custom,
      settings,
    });
    expect(final).toEqual(states.at(-1));
    expect(final.phase).toBe('FINISHED');
    // A single rejection ends it, so no quest ever saw a second proposal.
    for (const quest of [0, 1, 2, 3, 4]) {
      expect(final.proposals.filter((proposal) => proposal.quest === quest).length).toBeLessThan(2);
    }
    expect(final.lady?.inspections.length ?? 0).toBeLessThanOrEqual(1);
  });
});
