import { runMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { HarmoniesConfig } from '../src/index.js';
import { MAP_A, MAP_B, context, engine, gameConfig as defaults } from './fixtures/states.js';

const SMALL = { mapId: 'small' };

/** A deliberately different game: one 3x3 map, three colours, one card. */
const custom: HarmoniesConfig = {
  maps: [
    {
      id: 'small',
      name: 'Small',
      boardCells: [0, 1, 2].flatMap((q) => [0, 1, 2].map((r) => ({ q, r }))),
      waterScoring: 'islands',
    },
  ],
  tokenCounts: { water: 10, mountain: 0, trunk: 0, leaf: 10, field: 10, building: 0 },
  cards: [
    {
      id: 'newt',
      name: 'Sa giông',
      pointsByAnimalsPlaced: [0, 6],
      habitat: {
        cells: [
          { q: 0, r: 0, terrain: 'WATER', height: 1, animalSlot: true },
          { q: 1, r: 0, terrain: 'TREE', height: 1, animalSlot: false },
        ],
      },
    },
  ],
};

type Raw = Record<string, unknown>;
type RawCard = Raw & { habitat: unknown };

function withConfig(patch: (config: Raw) => void): unknown {
  const copy = JSON.parse(JSON.stringify(defaults)) as Raw;
  patch(copy);
  return copy;
}

/** The default config with its first map altered. */
function withMap(patch: (map: Raw) => void): unknown {
  return withConfig((config) => patch((config.maps as Raw[])[0]!));
}

/** The default config with its first card altered. */
function withCard(patch: (card: RawCard) => void): unknown {
  return withConfig((config) => patch((config.cards as RawCard[])[0]!));
}

const cells = (card: RawCard): Raw[] => (card.habitat as { cells: Raw[] }).cells;

describe('default config', () => {
  it('offers side A with river scoring and side B with island scoring', () => {
    expect(defaults.maps.map((map) => [map.id, map.boardCells.length, map.waterScoring])).toEqual([
      ['A', 23, 'river'],
      ['B', 25, 'islands'],
    ]);
  });
});

describe('parseConfig', () => {
  it('accepts the default config unchanged', () => {
    expect(engine.parseConfig(defaults)).toEqual({ ok: true, config: defaults });
  });

  it('survives a round trip through JSON, as it does through the database', () => {
    expect(engine.parseConfig(JSON.parse(JSON.stringify(custom)))).toEqual({
      ok: true,
      config: custom,
    });
  });

  it('keeps only the fields it knows', () => {
    const result = engine.parseConfig(
      withConfig((config) => {
        config.secret = 'x';
        (config.maps as Raw[])[0]!.cheat = true;
        (config.cards as Raw[])[0]!.cheat = true;
      }),
    );
    expect(result).toEqual({ ok: true, config: defaults });
  });

  const invalid: Array<[string, unknown]> = [
    ['not an object', null],
    ['missing everything', {}],
    ['a config from before maps existed', withConfig((c) => delete c.maps)],
    ['no maps', withConfig((c) => (c.maps = []))],
    ['two maps with the same id', withConfig((c) => ((c.maps as Raw[])[1]!.id = 'A'))],
    ['a map without a name', withMap((map) => delete map.name)],
    ['a map that is too small', withMap((map) => (map.boardCells = [{ q: 0, r: 0 }]))],
    ['a duplicate map cell', withMap((map) => (map.boardCells as unknown[]).push({ q: 0, r: 0 }))],
    [
      'a fractional coordinate',
      withMap((map) => ((map.boardCells as unknown[])[0] = { q: 0.5, r: 0 })),
    ],
    ['an unknown water scoring', withMap((map) => (map.waterScoring = 'lakes'))],
    ['a map with no water scoring', withMap((map) => delete map.waterScoring)],
    ['a missing token colour', withConfig((c) => delete (c.tokenCounts as Raw).water)],
    ['a negative token count', withConfig((c) => ((c.tokenCounts as Raw).water = -1))],
    [
      'too few tokens to deal the central board',
      withConfig(
        (c) =>
          (c.tokenCounts = { water: 14, mountain: 0, trunk: 0, leaf: 0, field: 0, building: 0 }),
      ),
    ],
    [
      'a duplicate card id',
      withConfig((c) => (c.cards as unknown[]).push((c.cards as unknown[])[0])),
    ],
    ['an unknown terrain', withCard((card) => (cells(card)[0]!.terrain = 'LAVA'))],
    [
      'a height the stacking rules cannot reach',
      withCard((card) => Object.assign(cells(card)[0]!, { terrain: 'WATER', height: 2 })),
    ],
    [
      'a habitat with no animal slot',
      withCard((card) => cells(card).forEach((cell) => (cell.animalSlot = false))),
    ],
    [
      'a habitat with two animal slots',
      withCard((card) => cells(card).forEach((cell) => (cell.animalSlot = true))),
    ],
    [
      'two habitat cells in the same place',
      withCard((card) =>
        Object.assign(cells(card)[1]!, { q: cells(card)[0]!.q, r: cells(card)[0]!.r }),
      ),
    ],
    [
      'a habitat of a single cell',
      withCard((card) => (card.habitat = { cells: [cells(card)[0]] })),
    ],
    ['a card with no animals', withCard((card) => (card.pointsByAnimalsPlaced = [0]))],
    ['points that go down', withCard((card) => (card.pointsByAnimalsPlaced = [0, 5, 3]))],
  ];

  it.each(invalid)('rejects %s', (_label, raw) => {
    const result = engine.parseConfig(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});

describe('parseSettings', () => {
  it('defaults to the first map when a room is created without settings', () => {
    expect(engine.parseSettings(undefined, defaults)).toEqual({ ok: true, settings: MAP_A });
    expect(engine.parseSettings({}, defaults)).toEqual({ ok: true, settings: MAP_A });
    expect(engine.parseSettings(undefined, custom)).toEqual({ ok: true, settings: SMALL });
  });

  it('accepts a map the config offers and drops anything else sent along', () => {
    expect(engine.parseSettings({ mapId: 'B', boardCells: [] }, defaults)).toEqual({
      ok: true,
      settings: MAP_B,
    });
  });

  it.each([{ mapId: 'C' }, { mapId: 7 }, 'B', ['B']])('rejects %j', (raw) => {
    expect(engine.parseSettings(raw, defaults).ok).toBe(false);
  });

  it('rejects a map that only exists in another config', () => {
    expect(engine.parseSettings(MAP_B, custom).ok).toBe(false);
  });
});

describe('the map chosen for a match', () => {
  const start = (settings: { mapId: string }) =>
    engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 'maps',
      config: defaults,
      settings,
    });

  it('gives every player that map and tells viewers which one it is', () => {
    const a = engine.getPublicView(start(MAP_A), { type: 'spectator' });
    const b = engine.getPublicView(start(MAP_B), { type: 'spectator' });

    expect(a.map).toEqual({ id: 'A', name: 'Mặt A – Sông' });
    expect(a.boardCells).toHaveLength(23);
    expect(a.waterScoring).toBe('river');

    expect(b.map).toEqual({ id: 'B', name: 'Mặt B – Đảo' });
    expect(b.boardCells).toHaveLength(25);
    expect(b.waterScoring).toBe('islands');
  });

  it('does not change the deal: only the board differs', () => {
    const a = start(MAP_A);
    const b = start(MAP_B);
    expect(b.pouch).toEqual(a.pouch);
    expect(b.cardRiver).toEqual(a.cardRiver);
    expect(b.turnOrder).toEqual(a.turnOrder);
  });

  it('scores the same water differently on each side', () => {
    const withWater = (settings: { mapId: string }) => {
      const state = start(settings);
      const me = state.turn.activePlayerId;
      const board = {
        stacks: { '1,0': ['water'], '1,1': ['water'], '1,2': ['water'] },
        cubes: [],
        cards: [],
      } as (typeof state.boards)[string];
      const view = engine.getPublicView(
        { ...state, boards: { ...state.boards, [me]: board } },
        { type: 'spectator' },
      );
      return view.scores[me]?.water;
    };
    // Side A: a river of three. Side B: that column is a wall, so two islands.
    expect(withWater(MAP_A)).toBe(5);
    expect(withWater(MAP_B)).toBe(10);
  });

  it('keeps the chosen setup in the state, out of reach of later config changes', () => {
    const state = start(MAP_B);
    expect(state.config.mapId).toBe('B');
    expect(state.config.boardCells).toHaveLength(25);
    expect(state.config).not.toHaveProperty('maps');
  });

  it('refuses a map the config does not have', () => {
    expect(() => start({ mapId: 'C' })).toThrow();
  });
});

describe('a match set up from a custom config', () => {
  const start = () =>
    engine.createInitialState({
      gameId: 'g',
      players: seats(2),
      seed: 'custom',
      config: custom,
      settings: SMALL,
    });

  it('uses the configured pouch, deck and board', () => {
    const state = start();
    const allTokens = [...state.pouch, ...state.centralSpaces.flat()];

    expect(allTokens).toHaveLength(30);
    expect(new Set(allTokens)).toEqual(new Set(['water', 'leaf', 'field']));
    expect(state.cardRiver).toEqual(['newt']);
    expect(state.cardDeck).toEqual([]);

    const view = engine.getPublicView(state, { type: 'spectator' });
    expect(view.boardCells).toEqual(custom.maps[0]?.boardCells);
    expect(view.cardRiver).toEqual(custom.cards);
  });

  it('plays on the configured board, not a default one', () => {
    let state = start();
    const me = state.turn.activePlayerId;
    state = engine.applyAction(state, { type: 'TAKE_TOKENS', spaceIndex: 0 }, context(me));
    const color = state.turn.hand[0]!;
    const place = (q: number, r: number) =>
      engine.validateAction(state, { type: 'PLACE_TOKEN', color, cell: { q, r } }, context(me));

    // (4,0) is on side A but not on this map; (1,2) is on this map.
    expect(place(4, 0)).toMatchObject({ valid: false, code: 'INVALID_POSITION' });
    expect(place(1, 2)).toEqual({ valid: true });

    const legal = engine.getPublicView(state, { type: 'player', playerId: me }).legal;
    expect(legal.tokenCells[color]).toHaveLength(9);
  });

  it('can be replayed with nothing but the seed, config and settings', () => {
    const input = {
      seed: 'custom',
      players: seats(2),
      config: custom,
      settings: SMALL,
      actions: [],
    };
    expect(runMatch(engine, input)).toEqual(runMatch(engine, input));
    // With no settings given, the engine falls back to the config's first map.
    expect(runMatch(engine, { ...input, settings: undefined }).config.mapId).toBe('small');
  });
});
