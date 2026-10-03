import { runMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { DevelopmentCard } from '../src/domain/cards.js';
import type { SplendorConfig } from '../src/domain/game-config.js';
import { GEM_COLORS, type GemColor } from '../src/domain/gems.js';
import { scriptFullGame } from './fixtures/script.js';
import { engine, gameConfig, gems } from './fixtures/states.js';

const defaults = (): SplendorConfig => JSON.parse(JSON.stringify(gameConfig)) as SplendorConfig;

function withConfig(patch: Record<string, unknown>): unknown {
  return { ...defaults(), ...patch };
}

function withCard(patch: Record<string, unknown>): unknown {
  const config = defaults();
  return { ...config, cards: [{ ...config.cards[0], ...patch }, ...config.cards.slice(1)] };
}

function withNoble(patch: Record<string, unknown>): unknown {
  const config = defaults();
  return { ...config, nobles: [{ ...config.nobles[0], ...patch }, ...config.nobles.slice(1)] };
}

/**
 * A small game with only tier 1 cards and piles too small to ever take two of a colour: every
 * card gives a point and costs two gems of the next colour round.
 */
const tiny: SplendorConfig = {
  cards: GEM_COLORS.flatMap((bonus, index) =>
    Array.from({ length: 6 }, (_, copy): DevelopmentCard => {
      const pays = GEM_COLORS[(index + 1) % GEM_COLORS.length] as GemColor;
      return { id: `${bonus}-${copy}`, tier: 1, bonus, points: 1, cost: gems({ [pays]: 2 }) };
    }),
  ),
  nobles: [{ id: 'patron', name: 'Patron', points: 2, requirement: gems({ white: 2 }) }],
  setupByPlayerCount: {
    2: { gemsPerColor: 3, nobles: 1 },
    3: { gemsPerColor: 3, nobles: 1 },
    4: { gemsPerColor: 3, nobles: 0 },
  },
  goldCount: 2,
  targetScoreOptions: [5, 4],
  defaultTargetScore: 5,
};

describe('the default deck', () => {
  const cards = gameConfig.cards;
  const count = (test: (card: DevelopmentCard) => boolean) => cards.filter(test).length;

  it('has 40, 30 and 20 cards in tiers 1, 2 and 3', () => {
    expect([1, 2, 3].map((tier) => count((card) => card.tier === tier))).toEqual([40, 30, 20]);
    expect(new Set(cards.map((card) => card.id)).size).toBe(90);
  });

  it('has 8, 6 and 4 cards of each colour', () => {
    for (const color of GEM_COLORS) {
      expect(
        [1, 2, 3].map((tier) => count((card) => card.tier === tier && card.bonus === color)),
      ).toEqual([8, 6, 4]);
    }
  });

  it('is worth 140 points', () => {
    expect(cards.reduce((sum, card) => sum + card.points, 0)).toBe(140);
  });

  it('gives every colour the same set of costs and points', () => {
    const shapes = (color: GemColor) =>
      cards
        .filter((card) => card.bonus === color)
        .map((card) => {
          const costs = GEM_COLORS.map((gem) => card.cost[gem])
            .filter((cost) => cost > 0)
            .sort();
          return `${card.tier}:${card.points}:${costs.join('+')}`;
        })
        .sort();
    for (const color of GEM_COLORS) expect(shapes(color)).toEqual(shapes('white'));
  });

  it('has ten nobles worth 3 points, each asking for 3+3+3 or 4+4', () => {
    expect(gameConfig.nobles).toHaveLength(10);
    for (const noble of gameConfig.nobles) {
      expect(noble.points).toBe(3);
      const asks = GEM_COLORS.map((gem) => noble.requirement[gem])
        .filter((need) => need > 0)
        .join('+');
      expect(['3+3+3', '4+4']).toContain(asks);
    }
    expect(new Set(gameConfig.nobles.map((noble) => JSON.stringify(noble.requirement))).size).toBe(
      10,
    );
  });
});

describe('parseConfig', () => {
  it('accepts the default config unchanged', () => {
    expect(engine.parseConfig(gameConfig)).toEqual({ ok: true, config: gameConfig });
  });

  it('accepts a config that has been through JSON', () => {
    expect(engine.parseConfig(defaults())).toEqual({ ok: true, config: gameConfig });
  });

  it('keeps only the fields it knows', () => {
    const parsed = engine.parseConfig(withCard({ artwork: 'x' }));
    expect(parsed).toEqual({ ok: true, config: gameConfig });
    expect(engine.parseConfig(withConfig({ extra: true }))).toEqual({
      ok: true,
      config: gameConfig,
    });
  });

  it('accepts a small custom config', () => {
    expect(engine.parseConfig(tiny)).toEqual({ ok: true, config: tiny });
  });

  const invalid: Array<[string, unknown]> = [
    ['a non-object', 'splendor'],
    ['a list', []],
    ['no cards', withConfig({ cards: [] })],
    ['cards that are not a list', withConfig({ cards: {} })],
    ['a duplicate card id', withCard({ id: gameConfig.cards[1]?.id })],
    ['an empty card id', withCard({ id: '' })],
    ['an unknown tier', withCard({ tier: 4 })],
    ['an unknown bonus colour', withCard({ bonus: 'gold' })],
    ['negative points', withCard({ points: -1 })],
    ['fractional points', withCard({ points: 1.5 })],
    ['a cost missing a colour', withCard({ cost: { white: 1 } })],
    ['a negative cost', withCard({ cost: gems({ blue: -1 }) })],
    ['a cost that is not an object', withCard({ cost: 3 })],
    ['a duplicate noble id', withNoble({ id: gameConfig.nobles[1]?.id })],
    ['a noble without a name', withNoble({ name: undefined })],
    ['a noble asking for nothing', withNoble({ requirement: gems() })],
    ['a noble with a bad requirement', withNoble({ requirement: { white: 'many' } })],
    ['no setup table', withConfig({ setupByPlayerCount: undefined })],
    [
      'a missing player count',
      withConfig({ setupByPlayerCount: { 2: { gemsPerColor: 4, nobles: 3 } } }),
    ],
    [
      'no gems on the table',
      withConfig({
        setupByPlayerCount: { ...defaults().setupByPlayerCount, 3: { gemsPerColor: 0, nobles: 4 } },
      }),
    ],
    [
      'more nobles dealt than exist',
      withConfig({
        setupByPlayerCount: {
          ...defaults().setupByPlayerCount,
          4: { gemsPerColor: 7, nobles: 11 },
        },
      }),
    ],
    ['a negative gold count', withConfig({ goldCount: -1 })],
    ['no target scores', withConfig({ targetScoreOptions: [] })],
    ['a target of zero', withConfig({ targetScoreOptions: [0, 15] })],
    ['a repeated target', withConfig({ targetScoreOptions: [15, 15] })],
    ['a default target that is not an option', withConfig({ defaultTargetScore: 12 })],
    ['a target the deck cannot reach', withConfig({ targetScoreOptions: [15, 23] })],
  ];

  it.each(invalid)('rejects %s', (_name, raw) => {
    const parsed = engine.parseConfig(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).not.toBe('');
  });

  it('allows a target as long as the cards outside every reserve can reach it', () => {
    // 140 points, less the 12 best cards (53), leaves 87: enough for four players to be
    // one short of 22 (85 points) and one more card to tip somebody over.
    expect(engine.parseConfig(withConfig({ targetScoreOptions: [15, 22] })).ok).toBe(true);
  });

  it('names the card that can never be bought', () => {
    const stuck = { ...tiny.cards[0], id: 'stuck', cost: gems({ black: 15 }) };
    const parsed = engine.parseConfig({ ...tiny, cards: [...tiny.cards, stuck] });
    expect(parsed).toMatchObject({ ok: false, message: expect.stringContaining('stuck') });
  });

  it('counts the bonuses of other cards towards an expensive one', () => {
    // Six black bonuses bring a cost of 11 black down to 5: three gems and two gold.
    const dear = { ...tiny.cards[0], id: 'dear', cost: gems({ black: 11 }) };
    expect(engine.parseConfig({ ...tiny, cards: [...tiny.cards, dear] }).ok).toBe(true);
  });
});

describe('parseSettings', () => {
  it('falls back to the default target', () => {
    expect(engine.parseSettings(undefined, gameConfig)).toEqual({
      ok: true,
      settings: { targetScore: 15 },
    });
    expect(engine.parseSettings({}, gameConfig)).toEqual({
      ok: true,
      settings: { targetScore: 15 },
    });
  });

  it('accepts a target the config offers and drops everything else', () => {
    expect(engine.parseSettings({ targetScore: 10, cheat: true }, gameConfig)).toEqual({
      ok: true,
      settings: { targetScore: 10 },
    });
  });

  it.each([{ targetScore: 12 }, { targetScore: '15' }, 15, [15]])('rejects %j', (raw) => {
    expect(engine.parseSettings(raw, gameConfig).ok).toBe(false);
  });

  it('checks against the config in force', () => {
    expect(engine.parseSettings({ targetScore: 10 }, tiny).ok).toBe(false);
    expect(engine.parseSettings({ targetScore: 4 }, tiny)).toEqual({
      ok: true,
      settings: { targetScore: 4 },
    });
  });
});

describe('a match set up from a custom config', () => {
  it.each([2, 3, 4])('plays by it to the end with %i players', (players) => {
    const actions = scriptFullGame('tiny', players, tiny);
    const final = runMatch(engine, {
      seed: 'tiny',
      players: seats(players),
      actions,
      config: tiny,
    });

    expect(final.phase).toBe('FINISHED');
    expect(final.config.targetScore).toBe(5);
    expect(final.config.cards).toEqual(tiny.cards);
    expect(final.market[2]).toEqual([null, null, null, null]);
    expect(actions.some((step) => step.action.type === 'TAKE_GEMS')).toBe(true);
    // Piles of three never allow taking two of a colour.
    expect(
      actions.every(
        (step) => step.action.type !== 'TAKE_GEMS' || new Set(step.action.colors).size > 1,
      ),
    ).toBe(true);
    const scores = engine.getResult(final)?.scores ?? {};
    expect(Math.max(...Object.values(scores))).toBeGreaterThanOrEqual(5);
  });

  it('plays to the target the host chose', () => {
    const settings = { targetScore: 4 };
    const actions = scriptFullGame('short', 2, tiny, settings);
    const final = runMatch(engine, {
      seed: 'short',
      players: seats(2),
      actions,
      config: tiny,
      settings,
    });
    expect(final.config.targetScore).toBe(4);
    expect(final.phase).toBe('FINISHED');
  });
});
