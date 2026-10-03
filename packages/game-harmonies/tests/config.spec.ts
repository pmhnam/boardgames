import { seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { HarmoniesConfig } from '../src/index.js';
import { config as defaults, context, engine } from './fixtures/states.js';

/** A deliberately different game: a 3x3 patch of hexes, three colours, one card. */
const custom: HarmoniesConfig = {
  boardCells: [0, 1, 2].flatMap((q) => [0, 1, 2].map((r) => ({ q, r }))),
  tokenCounts: { water: 10, mountain: 0, trunk: 0, leaf: 10, field: 10, building: 0 },
  waterScoring: 'river',
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

function withConfig(patch: (config: Record<string, unknown>) => void): unknown {
  const copy = JSON.parse(JSON.stringify(defaults)) as Record<string, unknown>;
  patch(copy);
  return copy;
}

type RawCard = Record<string, unknown> & { habitat: unknown };
type RawCell = Record<string, unknown>;

const cells = (card: RawCard): RawCell[] => (card.habitat as { cells: RawCell[] }).cells;

/** The default config with its first card altered. */
function withCard(patch: (card: RawCard) => void): unknown {
  return withConfig((config) => patch((config.cards as RawCard[])[0]!));
}

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

  it('defaults water scoring to islands when a stored config predates the setting', () => {
    const result = engine.parseConfig(withConfig((config) => delete config.waterScoring));
    expect(result).toMatchObject({ ok: true, config: { waterScoring: 'islands' } });
    expect(
      engine.parseConfig(withConfig((config) => (config.waterScoring = 'river'))),
    ).toMatchObject({ ok: true, config: { waterScoring: 'river' } });
  });

  it('keeps only the fields it knows', () => {
    const result = engine.parseConfig(
      withConfig((config) => {
        config.secret = 'x';
        (config.cards as Array<Record<string, unknown>>)[0]!.cheat = true;
      }),
    );
    expect(result).toEqual({ ok: true, config: defaults });
  });

  const invalid: Array<[string, unknown]> = [
    ['not an object', null],
    ['missing everything', {}],
    ['a board that is too small', withConfig((c) => (c.boardCells = [{ q: 0, r: 0 }]))],
    ['a duplicate board cell', withConfig((c) => (c.boardCells as unknown[]).push({ q: 0, r: 0 }))],
    [
      'a fractional coordinate',
      withConfig((c) => ((c.boardCells as unknown[])[0] = { q: 0.5, r: 0 })),
    ],
    [
      'a missing token colour',
      withConfig((c) => delete (c.tokenCounts as Record<string, unknown>).water),
    ],
    [
      'a negative token count',
      withConfig((c) => ((c.tokenCounts as Record<string, unknown>).water = -1)),
    ],
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
      withCard((card) => cells(card).forEach((c) => (c.animalSlot = false))),
    ],
    [
      'a habitat with two animal slots',
      withCard((card) => cells(card).forEach((c) => (c.animalSlot = true))),
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
    ['an unknown water scoring', withConfig((c) => (c.waterScoring = 'lakes'))],
  ];

  it.each(invalid)('rejects %s', (_label, raw) => {
    const result = engine.parseConfig(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(0);
  });
});

describe('a match set up from a custom config', () => {
  const start = () =>
    engine.createInitialState({ gameId: 'g', players: seats(2), seed: 'custom', config: custom });

  it('uses the configured pouch, deck and board', () => {
    const state = start();
    const allTokens = [...state.pouch, ...state.centralSpaces.flat()];

    expect(allTokens).toHaveLength(30);
    expect(new Set(allTokens)).toEqual(new Set(['water', 'leaf', 'field']));
    expect(state.cardRiver).toEqual(['newt']);
    expect(state.cardDeck).toEqual([]);

    const view = engine.getPublicView(state, { type: 'spectator' });
    expect(view.boardCells).toEqual(custom.boardCells);
    expect(view.cardRiver).toEqual(custom.cards);
  });

  it('plays on the configured board, not the default one', () => {
    let state = start();
    const me = state.turn.activePlayerId;
    state = engine.applyAction(state, { type: 'TAKE_TOKENS', spaceIndex: 0 }, context(me));
    const color = state.turn.hand[0]!;

    // (4,0) is on the default board but not on this one; (1,2) is the other way round.
    expect(
      engine.validateAction(
        state,
        { type: 'PLACE_TOKEN', color, cell: { q: 4, r: 0 } },
        context(me),
      ),
    ).toMatchObject({ valid: false, code: 'INVALID_POSITION' });
    expect(
      engine.validateAction(
        state,
        { type: 'PLACE_TOKEN', color, cell: { q: 1, r: 2 } },
        context(me),
      ),
    ).toEqual({ valid: true });

    const legal = engine.getPublicView(state, { type: 'player', playerId: me }).legal;
    expect(legal.tokenCells[color]).toHaveLength(9);
  });

  it('carries its config in the state, so later config changes cannot reach it', () => {
    const state = start();
    expect(state.config).toEqual(custom);
    // A second match from the defaults is unaffected by the first.
    const other = engine.createInitialState({
      gameId: 'h',
      players: seats(2),
      seed: 'custom',
      config: defaults,
    });
    expect(other.config.boardCells).toHaveLength(23);
    expect(state.config.boardCells).toHaveLength(9);
  });
});
