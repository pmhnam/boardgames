import { BOT_LEVELS, createSeededRandom, type BotLevel } from '@bgp/game-core';
import { deepFreeze, playBotMatch } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import { chooseDiscard, chooseResponse } from '../src/bot/bot.js';
import { evaluateSite, getPips, getYield } from '../src/bot/evaluate.js';
import { choosePlan, readView } from '../src/bot/model.js';
import type { CatanAction } from '../src/domain/actions.js';
import { RESOURCES, type ResourceCounts } from '../src/domain/resources.js';
import type { CatanState } from '../src/domain/state.js';
import { CatanBot } from '../src/index.js';
import {
  active,
  apply,
  build,
  corner,
  engine,
  hold,
  holdCards,
  inMain,
  newGame,
  others,
  pave,
  player,
  rigDice,
  side,
  started,
  validate,
  withTurn,
} from './fixtures/states.js';

function choose(
  state: CatanState,
  level: BotLevel,
  playerId = active(state),
  seed = 'r',
): CatanAction {
  return CatanBot.chooseAction({
    view: engine.getPublicView(state, { type: 'player', playerId }),
    playerId,
    level,
    random: createSeededRandom(seed),
  });
}

function modelOf(state: CatanState, playerId = active(state)) {
  return readView(engine.getPublicView(state, { type: 'player', playerId }), playerId);
}

/** Wins per level at tables of four with two seats each, every seed played both ways round. */
function wins(a: BotLevel, b: BotLevel, seeds: string[]): Record<BotLevel, number> {
  const tally = { [a]: 0, [b]: 0 } as Record<BotLevel, number>;
  for (const seed of seeds) {
    for (const levels of [
      [a, b, a, b],
      [b, a, b, a],
    ]) {
      const { state } = playBotMatch(engine, CatanBot, { seed, levels, maxActions: 2000 });
      const winnerId = state.winnerPlayerIds[0] as string;
      tally[levels[Number(winnerId.slice(1)) - 1] as BotLevel] += 1;
    }
  }
  return tally;
}

const seeds = (count: number) => Array.from({ length: count }, (_, index) => `strength-${index}`);

describe('CATAN bot', () => {
  // playBotMatch throws on any illegal action, so finishing is the assertion. It always asks
  // the first player who may act, so discards and the robber are played out of turn too.
  it.each<[BotLevel[], string, number]>([
    [['easy', 'easy', 'easy'], 'a', 20_000],
    [['easy', 'easy', 'easy', 'easy'], 'b', 20_000],
    [['normal', 'normal', 'normal'], 'c', 1500],
    [['normal', 'normal', 'normal', 'normal'], 'd', 1500],
    [['hard', 'hard', 'hard'], 'e', 1500],
    [['hard', 'hard', 'hard', 'hard'], 'f', 1500],
    [['easy', 'normal', 'hard', 'easy'], 'g', 3000],
  ])('finishes a game: %j', (levels, seed, maxActions) => {
    const { state } = playBotMatch(engine, CatanBot, { seed, levels, maxActions });
    expect(state.phase).toBe('FINISHED');
    expect(state.winnerPlayerIds).toHaveLength(1);
  });

  it('finishes the fixed setup', () => {
    const { state } = playBotMatch(engine, CatanBot, {
      seed: 'first-game',
      levels: ['normal', 'hard', 'normal'],
      settings: { boardSetup: 'fixed' },
      maxActions: 1500,
    });
    expect(state.phase).toBe('FINISHED');
  });

  it('is deterministic for the same view and random seed', () => {
    const state = newGame({}, { dealt: true, seed: 'same' });
    for (const level of BOT_LEVELS) {
      expect(choose(state, level, active(state), 'x')).toEqual(
        choose(state, level, active(state), 'x'),
      );
    }
  });

  it('decides from the player view alone, whatever the other hands hold', () => {
    const base = inMain();
    const me = active(base);
    const you = others(base)[0] as string;
    const state = hold(pave(build(base, me, corner(0, 0, 0)), me, side(0, 0, 'NE')), me, {
      brick: 1,
      wood: 1,
      ore: 2,
    });
    const before = hold(holdCards(state, you, ['knight']), you, { wool: 2, ore: 1 });
    const after = hold(holdCards(state, you, ['victoryPoint']), you, { wheat: 3 });

    for (const level of BOT_LEVELS) {
      expect(choose(after, level)).toEqual(choose(before, level));
    }
  });

  it('always picks something the engine accepts, at every step of a turn', () => {
    const base = started();
    const me = active(base);
    const you = others(base)[0] as string;
    const settled = hold(
      pave(build(build(base, me, corner(0, 0, 0)), you, corner(1, 0, 3)), me, side(0, 0, 'NE')),
      you,
      { wood: 9 },
    );
    const steps: [CatanState, string][] = [
      [newGame(), active(newGame())],
      [apply(newGame(), { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 0) }), me],
      [settled, me],
      [apply(rigDice(settled, 7), { type: 'ROLL_DICE' }), you],
      [withTurn(settled, { step: 'ROBBER', roll: [3, 4] }), me],
      [withTurn(settled, { step: 'MAIN', roll: [1, 2] }), me],
    ];
    for (const [state, playerId] of steps) {
      for (const level of BOT_LEVELS) {
        const action = choose(state, level, playerId);
        expect(validate(state, action, playerId)).toEqual({ valid: true });
      }
    }
  });
});

describe('getPips', () => {
  it('counts the ways two dice make a number', () => {
    expect([2, 3, 4, 5, 6, 8, 9, 10, 11, 12].map(getPips)).toEqual([1, 2, 3, 4, 5, 5, 4, 3, 2, 1]);
    expect(getPips(7)).toBe(0);
    expect(getPips(null)).toBe(0);
  });
});

describe('what the planning bots look for', () => {
  it('opens on a corner that produces as often as any', () => {
    // The test island: the best corners collect 12 or 13 pips.
    const state = newGame();
    const model = modelOf(state);
    const best = Math.max(
      ...model.topology.vertices.map((vertex) => evaluateSite(model, vertex, false)),
    );
    const action = choose(state, 'normal');
    expect(action.type).toBe('PLACE_SETUP_SETTLEMENT');
    expect(evaluateSite(model, (action as { vertex: string }).vertex, false)).toBe(best);
  });

  it('hard opens its second settlement on what it does not produce yet', () => {
    const base = newGame();
    const me = active(base);
    // A first settlement on brick and wool only: where the hills (6) meet the pasture (4).
    const first = corner(0, -1, 2);
    const state = build(base, me, first);
    const had = getYield(modelOf(state), first);
    expect(RESOURCES.filter((resource) => had[resource] > 0)).toEqual(['brick', 'wool']);

    const action = choose(state, 'hard') as { vertex: string };
    const gained = getYield(modelOf(state), action.vertex);
    const fresh = RESOURCES.filter((resource) => had[resource] === 0 && gained[resource] > 0);
    expect(fresh.length).toBeGreaterThanOrEqual(2);
  });

  it('builds a city when it can pay for one, on the settlement that produces most', () => {
    const base = inMain();
    const me = active(base);
    // Next to the 6 and the 4, and out on the coast next to a lone 5.
    const rich = corner(0, -1, 2);
    const poor = corner(-2, 2, 3);
    const state = hold(build(build(base, me, rich), me, poor), me, { wheat: 2, ore: 3 });
    for (const level of ['normal', 'hard'] as const) {
      expect(choose(state, level)).toEqual({ type: 'BUILD_CITY', vertex: rich });
    }
  });

  it('saves for the nearest thing it can build', () => {
    const base = inMain();
    const me = active(base);
    const settled = build(base, me, corner(0, 0, 0));
    expect(choosePlan(modelOf(hold(settled, me, { wheat: 2, ore: 2 })))).toMatchObject({
      goal: 'city',
      missing: 1,
    });
    // No road leads anywhere yet, so the next settlement starts with a road.
    expect(choosePlan(modelOf(hold(settled, me, { brick: 1 })))).toMatchObject({
      goal: 'road',
      missing: 1,
    });
    const reaching = pave(settled, me, side(0, 0, 'NE'), side(0, 0, 'E'));
    expect(choosePlan(modelOf(hold(reaching, me, { brick: 1, wood: 1, wool: 1 })))).toMatchObject({
      goal: 'settlement',
      missing: 1,
    });
  });

  it('trades four spare cards with the supply for the one card its plan lacks', () => {
    const base = inMain();
    const me = active(base);
    const state = hold(build(base, me, corner(0, 0, 0)), me, { wheat: 2, ore: 2, wood: 4 });
    for (const level of ['normal', 'hard'] as const) {
      expect(choose(state, level)).toEqual({ type: 'SUPPLY_TRADE', give: 'wood', receive: 'ore' });
    }
  });

  it('ends its turn rather than trade away what its plan needs', () => {
    const base = inMain();
    const me = active(base);
    const state = hold(build(base, me, corner(0, 0, 0)), me, { wheat: 2, ore: 2 });
    for (const level of ['normal', 'hard'] as const) {
      expect(choose(state, level)).toEqual({ type: 'END_TURN' });
    }
  });

  it('discards what its plan needs least', () => {
    const base = started();
    const me = active(base);
    const state = hold(build(base, me, corner(0, 0, 0)), me, {
      wheat: 2,
      ore: 3,
      wood: 4,
      wool: 1,
    });
    // Ten cards, five to give up: the city's five stay.
    expect(chooseDiscard(modelOf(state), 5)).toEqual({ wood: 4, wool: 1 });
  });

  it('moves the robber onto the others, never onto itself when it can help it', () => {
    const base = withTurn(started(), { step: 'ROBBER', roll: [3, 4] });
    const me = active(base);
    const [second, third] = others(base) as [string, string];
    // Everyone on the 6; the second player alone on the 8.
    const state = hold(
      build(
        build(build(base, me, corner(0, -1, 0)), second, corner(0, -1, 3)),
        second,
        corner(2, 0, 0),
        'city',
      ),
      third,
      { ore: 1 },
    );
    for (const level of ['normal', 'hard'] as const) {
      expect(choose(state, level)).toMatchObject({ type: 'MOVE_ROBBER', hex: '2,0' });
    }
  });

  it('hard robs whoever is nearest to winning', () => {
    const base = withTurn(started(), { step: 'ROBBER', roll: [3, 4] });
    const [second, third] = others(base) as [string, string];
    // Both on the 8; the third player has a city elsewhere and fewer cards.
    const state = hold(
      hold(
        build(
          build(build(base, second, corner(2, 0, 0)), third, corner(2, 0, 3)),
          third,
          corner(-2, 2, 3),
          'city',
        ),
        second,
        { ore: 5 },
      ),
      third,
      { ore: 1 },
    );
    expect(choose(state, 'hard')).toEqual({ type: 'MOVE_ROBBER', hex: '2,0', victimId: third });
    expect(choose(state, 'normal')).toEqual({ type: 'MOVE_ROBBER', hex: '2,0', victimId: second });
  });
});

describe('answering an offer', () => {
  /** The active player offers ore for wood to a player one ore short of a city. */
  function offered(give: Partial<ResourceCounts>, receive: Partial<ResourceCounts>) {
    const base = inMain();
    const me = active(base);
    const you = others(base)[0] as string;
    const state = hold(hold(build(base, you, corner(0, 0, 0)), me, { ore: 3, brick: 3 }), you, {
      wheat: 2,
      ore: 2,
      wood: 2,
    });
    return { state: apply(state, { type: 'PROPOSE_TRADE', give, receive }), me, you };
  }

  it('says yes to a card its plan lacks for a card it does not need', () => {
    const { state, you } = offered({ ore: 1 }, { wood: 1 });
    expect(chooseResponse(modelOf(state, you), false)).toBe(true);
    expect(choose(state, 'normal', you)).toEqual({
      type: 'RESPOND_TRADE',
      offerId: 1,
      accept: true,
    });
    expect(choose(state, 'hard', you)).toEqual({ type: 'RESPOND_TRADE', offerId: 1, accept: true });
  });

  it('says no when the offer brings nothing its plan lacks', () => {
    const { state, you } = offered({ brick: 1 }, { wood: 1 });
    expect(chooseResponse(modelOf(state, you), false)).toBe(false);
  });

  it('says no when the price is a card its plan needs', () => {
    const { state, you } = offered({ ore: 1 }, { wheat: 1 });
    expect(chooseResponse(modelOf(state, you), false)).toBe(false);
  });

  it('says no to a lopsided offer', () => {
    const base = inMain();
    const me = active(base);
    const you = others(base)[0] as string;
    const state = apply(
      hold(hold(build(base, you, corner(0, 0, 0)), me, { ore: 1 }), you, {
        wheat: 2,
        ore: 2,
        wood: 3,
      }),
      { type: 'PROPOSE_TRADE', give: { ore: 1 }, receive: { wood: 3 } },
    );
    expect(chooseResponse(modelOf(state, you), false)).toBe(false);
  });

  it('says no when it does not hold the cards asked for', () => {
    const { state, you } = offered({ ore: 1 }, { wool: 1 });
    for (const level of BOT_LEVELS) {
      expect(choose(state, level, you)).toEqual({
        type: 'RESPOND_TRADE',
        offerId: 1,
        accept: false,
      });
    }
  });

  it('hard will not help a player who is about to win', () => {
    const { state, me, you } = offered({ ore: 1 }, { wood: 1 });
    const leading = deepFreeze({
      ...build(
        build(build(state, me, corner(2, -2, 0), 'city'), me, corner(-2, 2, 0), 'city'),
        me,
        corner(2, 0, 0),
        'city',
      ),
      longestRoutePlayerId: me,
    });
    expect(player(leading, me)).toBeDefined();
    expect(chooseResponse(modelOf(leading, you), true)).toBe(false);
    expect(chooseResponse(modelOf(leading, you), false)).toBe(true);
  });
});

describe('strength', () => {
  it('normal beats easy', () => {
    const tally = wins('normal', 'easy', seeds(4));
    expect(tally.normal).toBeGreaterThanOrEqual(7);
  });

  it('hard beats normal', () => {
    const tally = wins('hard', 'normal', seeds(20));
    expect(tally.hard).toBeGreaterThan(tally.normal + 8);
  });
});
