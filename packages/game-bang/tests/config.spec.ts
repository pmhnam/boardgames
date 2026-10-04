import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../src/domain/characters.js';
import { MAX_PLAYERS } from '../src/domain/config.js';
import { DEFAULT_CARDS } from '../src/domain/default-deck.js';
import { PLAYER_COUNTS, getRoleCounts } from '../src/domain/game-config.js';
import { configWith, engine, gameConfig, newGame } from './fixtures/states.js';

const count = (kind: string) => DEFAULT_CARDS.filter((card) => card.kind === kind).length;

describe('the default config', () => {
  it('holds the 80 cards of the base game', () => {
    expect(DEFAULT_CARDS).toHaveLength(80);
    expect(count('bang')).toBe(25);
    expect(count('missed')).toBe(12);
    expect(count('beer')).toBe(6);
    expect(count('dynamite')).toBe(1);
  });

  it('holds sixteen characters, two of them with three life points', () => {
    expect(CHARACTER_IDS).toHaveLength(16);
    const frail = CHARACTER_IDS.filter((id) => gameConfig.characters[id].life === 3);
    expect(frail).toEqual(['elGringo', 'paulRegret']);
  });

  it('deals the roles of the rulebook', () => {
    expect(PLAYER_COUNTS.map((players) => getRoleCounts(gameConfig, players))).toEqual([
      { sheriff: 1, deputy: 0, outlaw: 2, renegade: 1 },
      { sheriff: 1, deputy: 1, outlaw: 2, renegade: 1 },
      { sheriff: 1, deputy: 1, outlaw: 3, renegade: 1 },
      { sheriff: 1, deputy: 2, outlaw: 3, renegade: 1 },
    ]);
    expect(getRoleCounts(gameConfig, 3)).toBeNull();
    expect(getRoleCounts(gameConfig, 8)).toBeNull();
  });

  it('is accepted by parseConfig, as a clean copy', () => {
    const parsed = engine.parseConfig({ ...gameConfig, extra: true });
    expect(parsed).toEqual({ ok: true, config: gameConfig });
    expect(parsed.ok && parsed.config.cards).not.toBe(gameConfig.cards);
  });
});

describe('parseConfig', () => {
  const card = { kind: 'bang', suit: 'hearts', rank: 5 };
  const rejects = (patch: Record<string, unknown>) =>
    expect(engine.parseConfig({ ...gameConfig, ...patch })).toMatchObject({ ok: false });

  it('rejects anything that is not a config', () => {
    for (const raw of [null, undefined, 'bang', [], 4]) {
      expect(engine.parseConfig(raw)).toMatchObject({ ok: false });
    }
  });

  it('rejects a bad deck', () => {
    rejects({ cards: 'all of them' });
    rejects({ cards: [...gameConfig.cards, 'bang'] });
    rejects({ cards: [...gameConfig.cards, { ...card, kind: 'nuke' }] });
    rejects({ cards: [...gameConfig.cards, { ...card, suit: 'stars' }] });
    rejects({ cards: [...gameConfig.cards, { ...card, rank: 1 }] });
    rejects({ cards: [...gameConfig.cards, { ...card, rank: 15 }] });
    rejects({ cards: [...gameConfig.cards, { ...card, rank: 2.5 }] });
    rejects({ cards: Array.from({ length: 301 }, () => card) });
  });

  it('rejects a deck too small to deal from, or with nothing to shoot', () => {
    rejects({ cards: gameConfig.cards.slice(0, 20) });
    rejects({ cards: gameConfig.cards.filter((each) => each.kind !== 'bang') });
  });

  it('rejects bad characters', () => {
    const missing = Object.fromEntries(
      Object.entries(gameConfig.characters).filter(([id]) => id !== 'bartCassidy'),
    );
    rejects({ characters: missing });
    rejects({ characters: [] });
    rejects({ characters: { ...gameConfig.characters, bartCassidy: { enabled: 'yes', life: 4 } } });
    rejects({ characters: { ...gameConfig.characters, bartCassidy: { enabled: true, life: 0 } } });
    rejects({ characters: { ...gameConfig.characters, bartCassidy: { enabled: true, life: 7 } } });
  });

  it('rejects too few characters to seat the largest table', () => {
    const characters = { ...gameConfig.characters };
    for (const id of CHARACTER_IDS.slice(0, CHARACTER_IDS.length - MAX_PLAYERS + 1)) {
      characters[id] = { enabled: false, life: 4 };
    }
    rejects({ characters });
  });

  it('rejects roles that do not fill a table, or leave the sheriff unopposed', () => {
    const roles = (patch: Record<string, unknown>) =>
      rejects({ roles: { ...gameConfig.roles, ...patch } });
    roles({ 5: undefined });
    roles({ 5: { deputy: 1, outlaw: 2, renegade: 2 } });
    roles({ 5: { deputy: 1, outlaw: 1, renegade: 1 } });
    roles({ 5: { deputy: 4, outlaw: 0, renegade: 0 } });
    roles({ 5: { deputy: -1, outlaw: 4, renegade: 1 } });
    rejects({ roles: null });
  });

  it('rejects rules out of range', () => {
    const rules = (patch: Record<string, unknown>) =>
      rejects({ rules: { ...gameConfig.rules, ...patch } });
    rules({ sheriffBonusLife: -1 });
    rules({ bangsPerTurn: 0 });
    rules({ outlawBounty: 7 });
    rules({ dynamiteDamage: 0 });
    rules({ beerMinPlayers: 1 });
    rules({ bangsPerTurn: '1' });
    rejects({ rules: undefined });
  });
});

describe('a match set up from another config', () => {
  it('deals its roles, its characters and their life points', () => {
    const characters = Object.fromEntries(
      CHARACTER_IDS.map((id, index) => [id, { enabled: index < 8, life: 2 }]),
    ) as typeof gameConfig.characters;
    const config = configWith({
      characters,
      rules: { sheriffBonusLife: 3 },
      roles: { 4: { deputy: 2, outlaw: 1, renegade: 0 } },
    });
    expect(engine.parseConfig(config)).toMatchObject({ ok: true });

    const state = newGame(4, 'other', config);
    const seated = Object.values(state.players);
    expect(seated.map((seat) => seat.role).sort()).toEqual([
      'deputy',
      'deputy',
      'outlaw',
      'sheriff',
    ]);
    expect(seated.every((seat) => CHARACTER_IDS.indexOf(seat.character) < 8)).toBe(true);
    for (const seat of seated) {
      const life = seat.role === 'sheriff' ? 5 : 2;
      expect(seat).toMatchObject({ maxLife: life, life });
    }
    expect(state.setup).toEqual({
      rules: config.rules,
      roleCounts: { sheriff: 1, deputy: 2, outlaw: 1, renegade: 0 },
    });
  });

  it('plays with its deck', () => {
    const cards = [...gameConfig.cards, { kind: 'gatling', suit: 'hearts', rank: 2 } as const];
    const state = newGame(4, 'deck', configWith({ cards }));
    expect(Object.keys(state.cards)).toHaveLength(81);
    expect(state.cards.c80).toEqual({ kind: 'gatling', suit: 'hearts', rank: 2 });
  });

  it('is kept by the match, whatever becomes of the config', () => {
    const config = configWith({ rules: { outlawBounty: 5 } });
    const state = newGame(4, 'kept', config);
    expect(state.setup.rules).toEqual(config.rules);
    expect(state.setup.rules).not.toBe(config.rules);
  });
});

describe('settings', () => {
  it('are nothing, whatever a host sends', () => {
    expect(engine.parseSettings(undefined)).toEqual({ ok: true, settings: {} });
    expect(engine.parseSettings(null)).toEqual({ ok: true, settings: {} });
    expect(engine.parseSettings({ expansion: 'dodge-city' })).toEqual({ ok: true, settings: {} });
    expect(engine.parseSettings('fast')).toMatchObject({ ok: false });
  });
});
