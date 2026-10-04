import { createSeededRandom, type BotLevel } from '@bgp/game-core';
import { playBotMatch } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { BangAction } from '../src/domain/actions.js';
import type { BangState } from '../src/domain/state.js';
import { BangBot } from '../src/index.js';
import {
  asPlayer,
  cardOf,
  endTurn,
  engine,
  play,
  respond,
  table,
  validate,
} from './fixtures/states.js';

function choose(state: BangState, playerId: string, level: BotLevel, seed = 'r'): BangAction {
  return BangBot.chooseAction({
    view: engine.getPublicView(state, asPlayer(playerId)),
    playerId,
    level,
    random: createSeededRandom(seed),
  });
}

const seeds = (count: number) => Array.from({ length: count }, (_, index) => `seed-${index}`);

// Whole matches: quick here, many times slower on the CI runner.
describe('BANG! bot', { timeout: 30_000 }, () => {
  // playBotMatch throws on any illegal action, so finishing is the assertion. The ceiling is
  // far below the default: a table that never comes to blows would hit it.
  it.each([
    [4, 'easy'],
    [4, 'normal'],
    [4, 'hard'],
    [5, 'normal'],
    [6, 'hard'],
    [7, 'easy'],
    [7, 'normal'],
    [7, 'hard'],
  ] as Array<[number, BotLevel]>)('plays a table of %i to the end at %s', (players, level) => {
    for (const seed of seeds(12)) {
      const { state } = playBotMatch(engine, BangBot, {
        seed,
        levels: Array.from({ length: players }, () => level),
        maxActions: 3000,
      });
      expect(engine.getGameStatus(state)).toBe('finished');
      expect(state.winnerPlayerIds.length).toBeGreaterThan(0);
    }
  });

  it('plays a mixed table to the end', () => {
    const levels: BotLevel[] = ['easy', 'hard', 'normal', 'hard', 'easy', 'normal'];
    for (const seed of seeds(12)) {
      const { state } = playBotMatch(engine, BangBot, { seed, levels, maxActions: 3000 });
      expect(engine.getGameStatus(state)).toBe('finished');
    }
  });

  it('decides the same way given the same view and randomness', () => {
    const state = table([{ hand: ['bang', 'beer', 'panic'] }, { hand: ['duel'] }, {}, {}]);
    for (const level of ['easy', 'normal', 'hard'] as BotLevel[]) {
      expect(choose(state, 'p1', level, 'same')).toEqual(choose(state, 'p1', level, 'same'));
    }
  });

  it('refuses a seat the match is not waiting on', () => {
    const state = table([{}, {}, {}, {}]);
    expect(() => choose(state, 'p2', 'normal')).toThrow();
  });

  it.each(['normal', 'hard'] as BotLevel[])('at %s, an outlaw goes for the sheriff', (level) => {
    const state = table([{}, { role: 'outlaw', hand: ['bang'] }, {}, {}], { turn: 'p2' });
    expect(choose(state, 'p2', level)).toMatchObject({ type: 'PLAY_CARD', targetId: 'p1' });
  });

  it.each(['normal', 'hard'] as BotLevel[])('at %s, a deputy never does', (level) => {
    const state = table(
      [{ life: 1 }, { role: 'deputy', hand: ['bang', 'duel', 'gatling', 'indians'] }, {}, {}],
      { turn: 'p2' },
    );
    for (const seed of seeds(10)) {
      const action = choose(state, 'p2', level, seed);
      expect(action.type).toBe('PLAY_CARD');
      expect(action).not.toMatchObject({ targetId: 'p1' });
      // Nor with a card that would hit the sheriff along with everyone else.
      expect(action).not.toMatchObject({ cardId: cardOf(state, 'p2', 'gatling') });
      expect(action).not.toMatchObject({ cardId: cardOf(state, 'p2', 'indians') });
    }
  });

  it.each(['normal', 'hard'] as BotLevel[])(
    'at %s, a renegade leaves the sheriff alone until they are the last two',
    (level) => {
      const crowd = table([{}, { role: 'renegade', hand: ['bang'] }, {}, {}], { turn: 'p2' });
      expect(choose(crowd, 'p2', level)).toMatchObject({ type: 'PLAY_CARD', targetId: 'p3' });

      const showdown = table(
        [{}, { role: 'renegade', hand: ['bang'] }, { alive: false }, { alive: false }],
        { turn: 'p2' },
      );
      expect(choose(showdown, 'p2', level)).toMatchObject({ type: 'PLAY_CARD', targetId: 'p1' });
    },
  );

  it('at hard, a sheriff will not shoot a stranger who may well be the deputy', () => {
    // Two strangers left, one of them the deputy: killing them would cost every card held.
    const seats = [{ hand: ['bang' as const] }, { role: 'deputy' as const }, { alive: false }, {}];
    const even = table(seats);
    expect(choose(even, 'p1', 'normal')).toMatchObject({ type: 'PLAY_CARD' });
    expect(choose(even, 'p1', 'hard')).toEqual({ type: 'END_TURN', discardIds: [] });

    // With the deputy dead and shown, every stranger is an enemy.
    const alone = table([seats[0] ?? {}, { role: 'deputy', alive: false }, {}, {}]);
    expect(choose(alone, 'p1', 'hard')).toMatchObject({ type: 'PLAY_CARD' });
  });

  it('at hard, a sheriff shoots back at whoever shot first', () => {
    const shot = table(
      [{ hand: ['missed'] }, { role: 'deputy' }, { alive: false }, { hand: ['bang'] }],
      { turn: 'p4', deckTop: ['bang', 'missed'] },
    );
    const state = endTurn(respond(play(shot, 'p4', 'bang', 'p1'), 'p1', 'missed'), 'p4');
    expect(choose(state, 'p1', 'hard')).toMatchObject({ type: 'PLAY_CARD', targetId: 'p4' });
  });

  it('at hard, an outlaw out of reach of the sheriff spares strangers who may be outlaws', () => {
    // Seat 3 of six: the sheriff is two seats away, and two of the four strangers are outlaws.
    const state = table([{}, {}, { hand: ['bang'] }, {}, {}, {}], { turn: 'p3' });
    expect(choose(state, 'p3', 'normal')).toMatchObject({ type: 'PLAY_CARD' });
    expect(choose(state, 'p3', 'hard')).toEqual({ type: 'END_TURN', discardIds: [] });

    // Once the other outlaws are dead and shown, nobody is spared.
    const last = table([{}, {}, { hand: ['bang'] }, { alive: false }, {}, { alive: false }], {
      turn: 'p3',
    });
    expect(choose(last, 'p3', 'hard')).toMatchObject({ type: 'PLAY_CARD' });
  });

  it('at hard, goes for whoever is closest to going down', () => {
    // With a Schofield both p3 and p4 are in reach, and neither has given more cause.
    const state = table(
      [{}, { role: 'deputy', hand: ['bang'], inPlay: ['schofield'] }, {}, { life: 1 }],
      { turn: 'p2' },
    );
    expect(choose(state, 'p2', 'normal')).toMatchObject({ type: 'PLAY_CARD', targetId: 'p3' });
    expect(choose(state, 'p2', 'hard')).toMatchObject({ type: 'PLAY_CARD', targetId: 'p4' });
  });

  it.each(['normal', 'hard'] as BotLevel[])('at %s, dodges when it can', (level) => {
    const shot = play(
      table([{ hand: ['bang'] }, { hand: ['beer', 'missed'] }, {}, {}]),
      'p1',
      'bang',
      'p2',
    );
    expect(choose(shot, 'p2', level)).toEqual({
      type: 'RESPOND',
      cardId: cardOf(shot, 'p2', 'missed'),
    });
  });

  it('does not throw one Missed! at a shot that takes two', () => {
    const shot = play(
      table([{ character: 'slabTheKiller', hand: ['bang'] }, { hand: ['beer', 'missed'] }, {}, {}]),
      'p1',
      'bang',
      'p2',
    );
    expect(choose(shot, 'p2', 'normal')).toEqual({ type: 'RESPOND', cardId: null });
  });

  it('puts its good cards to use before attacking, and drinks when hurt', () => {
    const state = table(
      [{}, { role: 'outlaw', life: 2, hand: ['bang', 'barrel', 'beer'] }, {}, {}],
      {
        turn: 'p2',
      },
    );
    expect(choose(state, 'p2', 'normal')).toMatchObject({ cardId: cardOf(state, 'p2', 'barrel') });
    const walled = play(state, 'p2', 'barrel');
    expect(choose(walled, 'p2', 'normal')).toMatchObject({ cardId: cardOf(walled, 'p2', 'beer') });
  });

  it('discards what it values least', () => {
    const state = table(
      [{}, { role: 'deputy', life: 1, hand: ['missed', 'jail', 'missed'] }, { alive: false }, {}],
      { turn: 'p2' },
    );
    // The jail is played on p4; of what is left, nothing is playable and one has to go.
    const jailed = play(state, 'p2', 'jail', 'p4');
    const action = choose(jailed, 'p2', 'normal');
    expect(action.type).toBe('END_TURN');
    expect(validate(jailed, action, 'p2')).toEqual({ valid: true });
  });

  it('takes the better card at the general store', () => {
    const store = play(
      table([{ hand: ['generalStore'] }, {}, {}, {}], {
        deckTop: ['jail', 'beer', 'duel', 'schofield'],
      }),
      'p1',
      'generalStore',
    );
    const picks = engine.getPublicView(store, asPlayer('p1')).pending?.cards ?? [];
    const beer = picks.find((card) => card.kind === 'beer');
    expect(choose(store, 'p1', 'normal')).toEqual({ type: 'PICK_CARDS', cardIds: [beer?.id] });
  });

  it('wins more often at hard than at easy', () => {
    // Seats alternate between the two levels; a win counts for each winner's level.
    const wins = { easy: 0, hard: 0 };
    for (const seed of seeds(60)) {
      const levels: BotLevel[] = ['hard', 'easy', 'hard', 'easy', 'hard', 'easy'];
      if (seed.length % 2 === 0) levels.reverse();
      const { state } = playBotMatch(engine, BangBot, { seed, levels, maxActions: 3000 });
      for (const winnerId of state.winnerPlayerIds) {
        const level = levels[state.seatOrder.indexOf(winnerId)];
        if (level === 'easy' || level === 'hard') wins[level] += 1;
      }
    }
    expect(wins.hard).toBeGreaterThan(wins.easy);
  });
});
