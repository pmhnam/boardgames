import { BOT_LEVELS, createSeededRandom, type BotLevel } from '@bgp/game-core';
import { deepFreeze, playBotMatch } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import { chooseReturn } from '../src/bot/bot.js';
import { UNREACHABLE, turnsToBuy } from '../src/bot/evaluate.js';
import { readView } from '../src/bot/model.js';
import type { SplendorAction } from '../src/domain/actions.js';
import type { SplendorState } from '../src/domain/state.js';
import { SplendorBot } from '../src/index.js';
import {
  active,
  apply,
  engine,
  gems,
  newGame,
  other,
  tokens,
  validate,
  withMarket,
  withPlayer,
  withPurchased,
} from './fixtures/states.js';

function choose(state: SplendorState, level: BotLevel, seed = 'r'): SplendorAction {
  const playerId = active(state);
  return SplendorBot.chooseAction({
    view: engine.getPublicView(state, { type: 'player', playerId }),
    playerId,
    level,
    random: createSeededRandom(seed),
  });
}

/** Wins per level over a set of seeds, each played from both seats; a shared win is half. */
function wins(a: BotLevel, b: BotLevel, seeds: string[]): Record<BotLevel, number> {
  const tally = { [a]: 0, [b]: 0 } as Record<BotLevel, number>;
  for (const seed of seeds) {
    for (const levels of [
      [a, b],
      [b, a],
    ]) {
      const { state } = playBotMatch(engine, SplendorBot, { seed, levels, maxActions: 1500 });
      for (const winnerId of state.winnerPlayerIds) {
        const level = levels[Number(winnerId.slice(1)) - 1] as BotLevel;
        tally[level] += 1 / state.winnerPlayerIds.length;
      }
    }
  }
  return tally;
}

const seeds = (count: number) => Array.from({ length: count }, (_, index) => `strength-${index}`);

describe('Splendor bot', () => {
  // playBotMatch throws on any illegal action, so finishing is the assertion. The ceiling is
  // far below the default: a table that only shuffles tokens around would hit it.
  it.each([
    [['easy', 'easy'], 'a'],
    [['easy', 'easy', 'easy', 'easy'], 'b'],
    [['normal', 'normal'], 'c'],
    [['normal', 'normal', 'normal'], 'd'],
    [['normal', 'easy', 'normal', 'easy'], 'e'],
    [['hard', 'hard'], 'f'],
    [['hard', 'normal', 'easy'], 'g'],
    [['hard', 'hard', 'hard', 'hard'], 'h'],
  ] as Array<[BotLevel[], string]>)(
    '%j only play legal actions and finish the game',
    (levels, seed) => {
      const { state, actionCount } = playBotMatch(engine, SplendorBot, {
        seed,
        levels,
        maxActions: 1500,
      });
      expect(engine.getGameStatus(state)).toBe('finished');
      expect(state.winnerPlayerIds.length).toBeGreaterThan(0);
      expect(actionCount).toBeGreaterThan(levels.length * 10);
    },
    60_000,
  );

  it('finishes a 10-point game sooner than a 20-point one', () => {
    const play = (targetScore: number) =>
      playBotMatch(engine, SplendorBot, {
        seed: 'target',
        levels: ['normal', 'normal'],
        settings: { targetScore },
        maxActions: 1500,
      }).actionCount;
    expect(play(10)).toBeLessThan(play(20));
  });

  it('is deterministic for the same view and random seed', () => {
    const state = newGame({}, { seed: 'det' });
    for (const level of BOT_LEVELS) expect(choose(state, level)).toEqual(choose(state, level));
  });

  it('decides from the player view alone, whatever the hidden cards are', () => {
    const start = newGame({}, { seed: 'view' });
    const owner = active(start);
    const state = apply(start, { type: 'RESERVE_FROM_DECK', tier: 2 });
    const held = state.players[owner]!.reserved[0]!.cardId;
    const inDeck = state.decks[2][0] as string;
    // The opponent's unseen reserve swaps with a deck card, and every deck is turned over.
    const shuffled = deepFreeze({
      ...state,
      decks: {
        1: [...state.decks[1]].reverse(),
        2: [held, ...state.decks[2].slice(1)].reverse(),
        3: [...state.decks[3]].reverse(),
      },
      players: {
        ...state.players,
        [owner]: { ...state.players[owner]!, reserved: [{ cardId: inDeck, blind: true }] },
      },
    });

    for (const level of BOT_LEVELS) expect(choose(shuffled, level)).toEqual(choose(state, level));
  });

  it.each(BOT_LEVELS)('%s gives back tokens when over the limit', (level) => {
    const base = newGame();
    const state = withPlayer(
      { ...base, turn: { ...base.turn, step: 'RETURN_GEMS' } },
      active(base),
      { tokens: tokens({ white: 3, blue: 3, green: 3, red: 2, gold: 1 }) },
    );
    const action = choose(state, level);
    expect(action.type).toBe('RETURN_GEMS');
    expect(validate(state, action)).toEqual({ valid: true });
  });

  it.each(BOT_LEVELS)('%s picks a noble when it has a choice', (level) => {
    const base = newGame();
    const nobles = engine.defaultConfig.nobles.filter((noble) =>
      ['noble-machiavelli', 'noble-anne-of-brittany'].includes(noble.id),
    );
    const purchased = ['white', 'blue', 'green'].flatMap((color) =>
      [1, 3, 4, 5].map((n) => `${color}-L1-0${n}`),
    );
    const state = withPurchased(
      {
        ...base,
        nobles: nobles.map((noble) => noble.id),
        config: { ...base.config, nobles },
        turn: { ...base.turn, step: 'CHOOSE_NOBLE' },
      },
      active(base),
      purchased,
    );
    const action = choose(state, level);
    expect(action.type).toBe('CHOOSE_NOBLE');
    expect(validate(state, action)).toEqual({ valid: true });
  });

  it('easy passes when there is nothing else to do', () => {
    const base = newGame({ bank: tokens() });
    const state = withPlayer(
      { ...base, decks: { ...base.decks, 3: base.decks[3].slice(3) } },
      active(base),
      { reserved: base.decks[3].slice(0, 3).map((cardId) => ({ cardId, blind: true })) },
    );
    expect(choose(state, 'easy')).toEqual({ type: 'PASS' });
    expect(choose(state, 'hard')).toEqual({ type: 'PASS' });
  });
});

describe('what the stronger bots look for', () => {
  const THIRTEEN = ['white-L3-04', 'blue-L3-04', 'green-L2-02']; // 5 + 5 + 3
  const WINNER = 'white-L2-01'; // 2 points for 5 red

  it.each(['normal', 'hard'] as BotLevel[])('%s buys the card that wins', (level) => {
    const base = withMarket(newGame(), [WINNER]);
    const playerId = active(base);
    const state = withPlayer(withPurchased(base, playerId, THIRTEEN), playerId, {
      tokens: tokens({ red: 5, blue: 2 }),
    });
    expect(choose(state, level)).toEqual({ type: 'BUY_CARD', cardId: WINNER });
  });

  it('hard takes away the card an opponent is about to win with', () => {
    const base = withMarket(newGame(), [WINNER]);
    const rival = other(base);
    const state = withPlayer(withPurchased(base, rival, THIRTEEN), rival, {
      tokens: tokens({ red: 5 }),
    });
    expect(choose(state, 'hard')).toEqual({ type: 'RESERVE_CARD', cardId: WINNER });
  });

  it('hard does not add a worthless card on its last turn, since fewer cards break a tie', () => {
    const FIFTEEN = ['white-L3-04', 'blue-L3-04', 'green-L3-04'];
    const RIVAL_FIFTEEN = ['red-L3-04', 'black-L3-04', 'white-L3-02', 'green-L1-02'];
    const base = withMarket(newGame(), ['white-L1-01']); // no points, 3 blue
    const [first, second] = base.turnOrder as [string, string];
    const tied = withPurchased(withPurchased(base, first, RIVAL_FIFTEEN), second, FIFTEEN);
    const state = withPlayer(
      { ...tied, finalRound: true, turn: { number: 2, activePlayerId: second, step: 'ACTION' } },
      second,
      { tokens: tokens({ blue: 3 }) },
    );

    expect(validate(state, { type: 'BUY_CARD', cardId: 'white-L1-01' })).toEqual({ valid: true });
    expect(choose(state, 'hard').type).not.toBe('BUY_CARD');
  });

  it('gives back the tokens its best card does not need, and never the gold first', () => {
    const base = withMarket(newGame(), ['blue-L2-02']); // 3 points for 6 blue
    const playerId = active(base);
    const state = withPlayer(base, playerId, {
      tokens: tokens({ blue: 4, white: 3, red: 3, gold: 2 }),
    });
    const model = readView(engine.getPublicView(state, { type: 'player', playerId }), playerId);

    const returned = chooseReturn(model, 2, false);
    expect(returned.blue).toBeUndefined();
    expect(returned.gold).toBeUndefined();
    expect((returned.white ?? 0) + (returned.red ?? 0)).toBe(2);
  });
});

describe('turnsToBuy', () => {
  const bank = tokens({ white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 5 });
  const seat = (held = tokens(), bonuses = gems()) => ({ tokens: held, bonuses });

  it('is zero for a card the seat can pay for', () => {
    expect(turnsToBuy(seat(tokens({ blue: 3 })), { cost: gems({ blue: 3 }) }, bank)).toBe(0);
    expect(turnsToBuy(seat(tokens(), gems({ blue: 3 })), { cost: gems({ blue: 3 }) }, bank)).toBe(
      0,
    );
    expect(turnsToBuy(seat(tokens({ blue: 1, gold: 2 })), { cost: gems({ blue: 3 }) }, bank)).toBe(
      0,
    );
  });

  it('counts three different gems a turn', () => {
    expect(turnsToBuy(seat(), { cost: gems({ white: 1, blue: 1, red: 1 }) }, bank)).toBe(1);
    expect(turnsToBuy(seat(), { cost: gems({ white: 2, blue: 2, red: 1 }) }, bank)).toBe(2);
  });

  it('counts two a turn for a single colour with a full pile', () => {
    expect(turnsToBuy(seat(), { cost: gems({ blue: 4 }) }, bank)).toBe(2);
    expect(turnsToBuy(seat(), { cost: gems({ blue: 3 }) }, { ...bank, blue: 3 })).toBe(3);
  });

  it('takes longer when the bank is short of a colour', () => {
    const short = turnsToBuy(seat(), { cost: gems({ blue: 3, red: 1 }) }, { ...bank, blue: 1 });
    expect(short).toBeGreaterThan(turnsToBuy(seat(), { cost: gems({ blue: 3, red: 1 }) }, bank));
  });

  it('is out of reach when the cost is more tokens than a player may hold', () => {
    const cost = gems({ white: 3, blue: 3, green: 5, red: 3 });
    expect(turnsToBuy(seat(), { cost }, bank)).toBe(UNREACHABLE);
    expect(turnsToBuy(seat(tokens(), gems({ green: 4 })), { cost }, bank)).toBeLessThan(
      UNREACHABLE,
    );
  });
});

describe('strength', () => {
  it('normal beats easy', () => {
    const tally = wins('normal', 'easy', seeds(5));
    expect(tally.normal).toBeGreaterThanOrEqual(8);
  }, 60_000);

  it('hard beats normal', () => {
    const tally = wins('hard', 'normal', seeds(6));
    expect(tally.hard).toBeGreaterThan(tally.normal);
    expect(tally.hard).toBeGreaterThanOrEqual(8);
  }, 120_000);
});
