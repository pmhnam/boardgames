import { describe, expect, it } from 'vitest';
import { MAX_PLAYERS, MIN_PLAYERS } from '../src/domain/config.js';
import { CompositionCodes } from '../src/domain/errors.js';
import {
  PLAYER_COUNTS,
  checkComposition,
  resolveRoles,
  type WerewolfConfig,
} from '../src/domain/game-config.js';
import { configWith, customSettings, engine, gameConfig } from './fixtures/states.js';

/** The default config as an admin would send it, with one part replaced. */
function raw(patch: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...(JSON.parse(JSON.stringify(gameConfig)) as Record<string, unknown>), ...patch };
}

function expectBadConfig(patch: Record<string, unknown>, message: RegExp): void {
  const parsed = engine.parseConfig(raw(patch));
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.message).toMatch(message);
}

describe('checkComposition', () => {
  it('fills the seats the special roles leave with villagers', () => {
    expect(checkComposition({ werewolf: 2, seer: 1 }, 8, gameConfig)).toEqual({
      ok: true,
      roleCounts: {
        villager: 5,
        werewolf: 2,
        alphaWerewolf: 0,
        seer: 1,
        bodyguard: 0,
        witch: 0,
        hunter: 0,
        cupid: 0,
        elder: 0,
        idiot: 0,
      },
    });
  });

  it('allows a table with no plain villager at all', () => {
    const cast = { werewolf: 2, seer: 1, bodyguard: 1, witch: 1 };
    expect(checkComposition(cast, 5, gameConfig)).toMatchObject({
      ok: true,
      roleCounts: { villager: 0 },
    });
  });

  it.each([
    ['no werewolf', { seer: 1 }, 8, CompositionCodes.NoWerewolf],
    [
      'more roles than players',
      { werewolf: 2, hunter: 2, seer: 1, witch: 1 },
      5,
      CompositionCodes.TooManyRoles,
    ],
    ['a pack of half the table', { werewolf: 3 }, 6, CompositionCodes.TooManyWerewolves],
    [
      'an alpha that tips the pack to half',
      { werewolf: 2, alphaWerewolf: 1 },
      6,
      CompositionCodes.TooManyWerewolves,
    ],
    [
      'more of a role than the config allows',
      { werewolf: 1, seer: 2 },
      8,
      CompositionCodes.RoleOverLimit,
    ],
    ['too few players', { werewolf: 1 }, MIN_PLAYERS - 1, CompositionCodes.InvalidPlayerCount],
    ['too many players', { werewolf: 1 }, MAX_PLAYERS + 1, CompositionCodes.InvalidPlayerCount],
  ])('refuses %s', (_, roles, playerCount, code) => {
    expect(checkComposition(roles, playerCount, gameConfig)).toMatchObject({ ok: false, code });
  });

  it('refuses a role the config has switched off, and names it', () => {
    const config = configWith({ roles: { cupid: { enabled: false, max: 1 } } });
    expect(checkComposition({ werewolf: 1, cupid: 1 }, 8, config)).toMatchObject({
      ok: false,
      code: CompositionCodes.RoleDisabled,
      role: 'cupid',
    });
  });
});

describe('the default config', () => {
  it('is accepted as it stands, and comes back unchanged', () => {
    expect(engine.parseConfig(raw())).toEqual({ ok: true, config: gameConfig });
  });

  it.each(PLAYER_COUNTS)('recommends a playable cast for %i players', (playerCount) => {
    const settings = { preset: 'recommended', revealRoleOnDeath: true } as const;
    const cast = resolveRoles(settings, playerCount, gameConfig);
    expect(cast.ok).toBe(true);
    if (!cast.ok) return;
    const seats = Object.values(cast.roleCounts).reduce((sum, count) => sum + count, 0);
    expect(seats).toBe(playerCount);
    expect(cast.roleCounts.villager).toBeGreaterThan(0);
  });
});

describe('parseConfig', () => {
  it('drops fields it does not know', () => {
    const parsed = engine.parseConfig(raw({ extra: true }));
    expect(parsed).toEqual({ ok: true, config: gameConfig });
  });

  it('refuses anything that is not a config', () => {
    for (const value of [null, 'config', [], 3]) expect(engine.parseConfig(value).ok).toBe(false);
  });

  it('refuses a missing or malformed role limit', () => {
    const withoutSeer = Object.fromEntries(
      Object.entries(gameConfig.roles).filter(([role]) => role !== 'seer'),
    );
    expectBadConfig({ roles: withoutSeer }, /roles\.seer/);
    expectBadConfig(
      { roles: { ...gameConfig.roles, seer: { enabled: 'yes', max: 1 } } },
      /roles\.seer\.enabled/,
    );
    expectBadConfig(
      { roles: { ...gameConfig.roles, seer: { enabled: true, max: -1 } } },
      /roles\.seer\.max/,
    );
  });

  it('refuses more than one cupid: the rules know a single couple', () => {
    expectBadConfig(
      { roles: { ...gameConfig.roles, cupid: { enabled: true, max: 2 } } },
      /roles\.cupid\.max/,
    );
  });

  it('refuses rules out of range', () => {
    expectBadConfig({ rules: { ...gameConfig.rules, alphaVoteWeight: 0 } }, /alphaVoteWeight/);
    expectBadConfig({ rules: { ...gameConfig.rules, elderExtraLives: 9 } }, /elderExtraLives/);
    expectBadConfig({ rules: { ...gameConfig.rules, witchCanHealSelf: 1 } }, /witchCanHealSelf/);
    expectBadConfig({ defaultRevealRoleOnDeath: 'yes' }, /defaultRevealRoleOnDeath/);
  });

  it('refuses a table size with no recommended cast', () => {
    const presets = Object.fromEntries(
      Object.entries(gameConfig.presets).filter(([playerCount]) => playerCount !== '9'),
    );
    expectBadConfig({ presets }, /presets\.9/);
  });

  it('refuses a recommended cast that could not be played', () => {
    expectBadConfig(
      { presets: { ...gameConfig.presets, 5: { seer: 1 } } },
      /presets\.5 cannot be played.*werewolf/,
    );
    expectBadConfig(
      { presets: { ...gameConfig.presets, 6: { werewolf: 3 } } },
      /presets\.6 cannot be played/,
    );
    // A recommendation must not lean on a role the same config switches off.
    expectBadConfig(
      { roles: { ...gameConfig.roles, witch: { enabled: false, max: 1 } } },
      /presets\.6 cannot be played.*witch/,
    );
  });
});

describe('parseSettings', () => {
  const parse = (value: unknown, config: WerewolfConfig = gameConfig) =>
    engine.parseSettings(value, config);

  it('gives a room without settings the recommended cast', () => {
    const defaults = { preset: 'recommended', revealRoleOnDeath: true };
    expect(parse(undefined)).toEqual({ ok: true, settings: defaults });
    expect(parse(null)).toEqual({ ok: true, settings: defaults });
    expect(parse({})).toEqual({ ok: true, settings: defaults });
  });

  it('takes the reveal default from the config', () => {
    const config = { ...gameConfig, defaultRevealRoleOnDeath: false };
    expect(parse(undefined, config)).toMatchObject({ settings: { revealRoleOnDeath: false } });
    expect(parse({ revealRoleOnDeath: true }, config)).toMatchObject({
      settings: { revealRoleOnDeath: true },
    });
  });

  it('accepts a custom cast, filling in the roles left out and dropping the rest', () => {
    const parsed = parse({
      preset: 'custom',
      roles: { werewolf: 2, seer: 1, villager: 9, dragon: 1 },
      extra: 1,
    });
    expect(parsed).toEqual({ ok: true, settings: customSettings({ werewolf: 2, seer: 1 }) });
  });

  it('forgets a cast when the room goes back to the recommended one', () => {
    const parsed = parse({ preset: 'recommended', roles: { werewolf: 5 } });
    expect(parsed).toEqual({
      ok: true,
      settings: { preset: 'recommended', revealRoleOnDeath: true },
    });
  });

  it.each([
    ['a non-object', 'custom'],
    ['an unknown preset', { preset: 'chaos' }],
    ['a custom cast without roles', { preset: 'custom' }],
    ['a negative count', { preset: 'custom', roles: { werewolf: -1 } }],
    ['a fractional count', { preset: 'custom', roles: { werewolf: 1.5 } }],
    ['a cast with no werewolf', { preset: 'custom', roles: { seer: 1 } }],
    ['more of a role than allowed', { preset: 'custom', roles: { werewolf: 1, seer: 2 } }],
    ['a reveal that is not a boolean', { revealRoleOnDeath: 'yes' }],
  ])('refuses %s', (_, value) => {
    expect(parse(value).ok).toBe(false);
  });

  it('refuses a pack too big for even the largest table', () => {
    const config = configWith({ roles: { werewolf: { enabled: true, max: 8 } } });
    expect(parse({ preset: 'custom', roles: { werewolf: 7 } }, config).ok).toBe(true);
    expect(parse({ preset: 'custom', roles: { werewolf: 8 } }, config).ok).toBe(false);
  });

  it('refuses a role the config has switched off', () => {
    const config = configWith({ roles: { idiot: { enabled: false, max: 1 } } });
    expect(parse({ preset: 'custom', roles: { werewolf: 1, idiot: 1 } }, config).ok).toBe(false);
  });
});

describe('validateSetup', () => {
  const check = (roles: Parameters<typeof customSettings>[0], playerCount: number) =>
    engine.validateSetup({ config: gameConfig, settings: customSettings(roles), playerCount });

  it('accepts a cast that fits the table', () => {
    expect(check({ werewolf: 2, seer: 1 }, 7)).toEqual({ valid: true });
  });

  it('refuses one that does not, with the reason as a code', () => {
    const cast = { werewolf: 2, seer: 1, witch: 1, bodyguard: 1, hunter: 1 };
    expect(check(cast, 5)).toMatchObject({ valid: false, code: CompositionCodes.TooManyRoles });
    expect(check({ werewolf: 3 }, 6)).toMatchObject({
      valid: false,
      code: CompositionCodes.TooManyWerewolves,
    });
    expect(check(cast, 8)).toEqual({ valid: true });
  });

  it('always accepts the recommended cast', () => {
    for (const playerCount of PLAYER_COUNTS) {
      const settings = { preset: 'recommended', revealRoleOnDeath: true } as const;
      expect(engine.validateSetup({ config: gameConfig, settings, playerCount })).toEqual({
        valid: true,
      });
    }
  });
});
