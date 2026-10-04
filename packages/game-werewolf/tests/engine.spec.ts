import { runMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import { CompositionCodes } from '../src/domain/errors.js';
import { PLAYER_COUNTS, resolveRoles } from '../src/domain/game-config.js';
import { ROLE_IDS, type RoleCounts } from '../src/domain/roles.js';
import type { WerewolfState } from '../src/domain/state.js';
import { listEveryAction, listLegalActions, scriptFullGame } from './fixtures/script.js';
import {
  apply,
  asPlayer,
  configWith,
  customSettings,
  engine,
  gameConfig,
  validate,
} from './fixtures/states.js';

const RECOMMENDED = { preset: 'recommended', revealRoleOnDeath: true } as const;

function start(
  playerCount: number,
  seed = 'seed',
  settings = engine.parseSettings(undefined, gameConfig),
) {
  if (!settings.ok) throw new Error(settings.message);
  return engine.createInitialState({
    gameId: 'g',
    players: seats(playerCount),
    seed,
    config: gameConfig,
    settings: settings.settings,
  });
}

function countRoles(state: WerewolfState): RoleCounts {
  const counts = Object.fromEntries(ROLE_IDS.map((role) => [role, 0])) as RoleCounts;
  for (const player of Object.values(state.players)) counts[player.role] += 1;
  return counts;
}

describe('setup', () => {
  it.each(PLAYER_COUNTS)('deals %i players exactly the recommended cast', (playerCount) => {
    const state = start(playerCount);
    const cast = resolveRoles(RECOMMENDED, playerCount, gameConfig);
    expect(cast.ok && cast.roleCounts).toEqual(countRoles(state));
    expect(state.setup.roleCounts).toEqual(countRoles(state));
    expect(state.seatOrder).toEqual(seats(playerCount).map((seat) => seat.playerId));
  });

  it('deals the cast the host picked', () => {
    const settings = customSettings({ werewolf: 1, alphaWerewolf: 1, hunter: 2, idiot: 1 }, false);
    const state = start(9, 'seed', { ok: true, settings });
    expect(countRoles(state)).toMatchObject({
      villager: 4,
      werewolf: 1,
      alphaWerewolf: 1,
      hunter: 2,
      idiot: 1,
      seer: 0,
    });
    expect(state.setup.revealRoleOnDeath).toBe(false);
  });

  it('deals the same roles for the same seed, and others for another', () => {
    const roles = (seed: string) =>
      Object.values(start(12, seed).players).map((player) => player.role);
    expect(roles('one')).toEqual(roles('one'));
    expect(
      ['two', 'three', 'four'].some((seed) => roles(seed).join() !== roles('one').join()),
    ).toBe(true);
  });

  it('seats players by seat, whatever order they are given in', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: [...seats(6)].reverse(),
      seed: 'seed',
      config: gameConfig,
      settings: RECOMMENDED,
    });
    expect(state.seatOrder).toEqual(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']);
  });

  it('starts on the first night with everyone alive and nothing known', () => {
    const state = start(8);
    expect(state).toMatchObject({ phase: 'NIGHT', round: 1, lovers: null, log: [], winner: null });
    expect(Object.values(state.players).every((player) => player.alive && player.canVote)).toBe(
      true,
    );
    expect(engine.getGameStatus(state)).toBe('playing');
  });

  it('keeps its own copy of the rules it was set up with', () => {
    const config = configWith({ rules: { elderExtraLives: 2, alphaVoteWeight: 3 } });
    const state = engine.createInitialState({
      gameId: 'g',
      players: seats(8),
      seed: 'seed',
      config,
      settings: customSettings({ werewolf: 1, elder: 1 }),
    });
    expect(state.setup.rules).toEqual(config.rules);
    expect(state.setup.rules).not.toBe(config.rules);
    const elder = Object.values(state.players).find((player) => player.role === 'elder');
    expect(elder?.extraLives).toBe(2);
  });

  it('refuses a cast that does not fit the table', () => {
    const settings = customSettings({ werewolf: 3 });
    expect(() => start(6, 'seed', { ok: true, settings })).toThrowError(
      expect.objectContaining({ code: CompositionCodes.TooManyWerewolves }),
    );
  });

  it.each([4, 17])('refuses a table of %i', (playerCount) => {
    expect(() => start(playerCount)).toThrowError(
      expect.objectContaining({ code: CompositionCodes.InvalidPlayerCount }),
    );
  });
});

describe('parseAction', () => {
  it('copies only the fields it knows', () => {
    expect(engine.parseAction({ type: 'WOLF_VOTE', targetId: 'p2', weight: 9 })).toEqual({
      ok: true,
      action: { type: 'WOLF_VOTE', targetId: 'p2' },
    });
    expect(engine.parseAction({ type: 'SLEEP', targetId: 'p2' })).toEqual({
      ok: true,
      action: { type: 'SLEEP' },
    });
  });

  it('reads a missing target as nobody, where nobody may be named', () => {
    expect(engine.parseAction({ type: 'CAST_VOTE' })).toEqual({
      ok: true,
      action: { type: 'CAST_VOTE', targetId: null },
    });
    expect(engine.parseAction({ type: 'WITCH_DECIDE', heal: true })).toEqual({
      ok: true,
      action: { type: 'WITCH_DECIDE', heal: true, poisonTargetId: null },
    });
  });

  it.each([
    [null],
    [{}],
    [{ type: 'HOWL' }],
    [{ type: 'WOLF_VOTE' }],
    [{ type: 'SEER_INSPECT', targetId: 3 }],
    [{ type: 'GUARD_PROTECT', targetId: null }],
    [{ type: 'CUPID_LINK', firstId: 'p1' }],
    [{ type: 'WITCH_DECIDE', poisonTargetId: 'p1' }],
    [{ type: 'CAST_VOTE', targetId: 3 }],
    [{ type: 'HUNTER_SHOOT', targetId: {} }],
  ])('refuses %j', (value) => {
    expect(engine.parseAction(value).ok).toBe(false);
  });
});

describe('full matches', () => {
  const games: Array<[string, number]> = [
    ['alpha', 5],
    ['bravo', 7],
    ['charlie', 10],
    ['delta', 12],
    ['echo', 14],
    ['foxtrot', 16],
  ];

  it.each(games)('replays %s (%i players) to the same end', (seed, players) => {
    const actions = scriptFullGame(seed, players);
    const run = () => runMatch(engine, { seed, players: seats(players), actions });

    const final = run();
    expect(final).toEqual(run());
    expect(final.phase).toBe('FINISHED');
    expect(final.winner).not.toBeNull();
  });

  it.each(games)('keeps %s (%i players) consistent after every action', (seed, players) => {
    const actions = scriptFullGame(seed, players);
    let state = start(players, seed);
    const cast = countRoles(state);
    // Spelled out once: the comparison below runs for every player at every step.
    const universe = listEveryAction(state.seatOrder).map((action) => ({
      action,
      key: JSON.stringify(action),
    }));

    for (const step of actions) {
      const before = state;
      // The match is never stuck: while it is on, it is waiting on somebody.
      const owing = engine.getCurrentPlayerIds(before);
      expect(owing.length).toBeGreaterThan(0);

      // What each view calls legal is exactly what the validator accepts from that player.
      for (const playerId of before.seatOrder) {
        const me = engine.getPublicView(before, asPlayer(playerId)).me;
        const listed = listLegalActions(me!.legal).map((action) => JSON.stringify(action));
        const accepted = universe
          .filter(({ action }) => validate(before, action, playerId).valid)
          .map(({ key }) => key);
        expect(accepted.sort()).toEqual(listed.sort());
        expect(listed.length > 0).toBe(owing.includes(playerId));
      }

      state = apply(before, step.action, step.playerId);

      // Nobody changes role or comes back from the dead, and rounds only go forward.
      expect(countRoles(state)).toEqual(cast);
      for (const playerId of state.seatOrder) {
        expect(state.players[playerId]?.role).toBe(before.players[playerId]?.role);
        if (!before.players[playerId]?.alive) expect(state.players[playerId]?.alive).toBe(false);
      }
      expect(state.round).toBeGreaterThanOrEqual(before.round);
      expect(state.log.length).toBeGreaterThanOrEqual(before.log.length);
      // The state is plain data: it survives the database round trip.
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    }

    expect(state.phase).toBe('FINISHED');
    expect(engine.getResult(state)?.winnerPlayerIds).toEqual(state.winnerPlayerIds);
  });

  it('plays by a config other than the default', () => {
    const config = configWith({
      rules: {
        guardCanProtectSelf: false,
        witchCanHealSelf: false,
        alphaVoteWeight: 1,
        elderExtraLives: 0,
      },
    });
    const settings = customSettings({
      werewolf: 2,
      alphaWerewolf: 1,
      bodyguard: 1,
      witch: 1,
      elder: 1,
    });
    const actions = scriptFullGame('custom', 11, config, settings);
    const final = runMatch(engine, {
      seed: 'custom',
      players: seats(11),
      actions,
      config,
      settings,
    });
    expect(final.phase).toBe('FINISHED');
    expect(final.setup.rules).toEqual(config.rules);
  });
});
