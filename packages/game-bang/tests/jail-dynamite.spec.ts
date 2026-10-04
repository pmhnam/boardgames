import { describe, expect, it } from 'vitest';
import { BangRuleCodes } from '../src/domain/errors.js';
import {
  configWith,
  endTurn,
  engine,
  expectRejected,
  handOf,
  inPlayOf,
  legalFor,
  play,
  playAction,
  player,
  table,
  topOfDiscard,
} from './fixtures/states.js';

describe('jail', () => {
  it('is put in front of another player, never the sheriff or one already in jail', () => {
    const state = table([{}, { hand: ['jail'] }, { inPlay: ['jail'] }, {}], { turn: 'p2' });
    expect(legalFor(state, 'p2').plays[0]?.targets).toEqual(['p4']);
    expectRejected(state, playAction(state, 'p2', 'jail', 'p1'), BangRuleCodes.InvalidTarget, 'p2');
    expectRejected(state, playAction(state, 'p2', 'jail', 'p3'), BangRuleCodes.InvalidTarget, 'p2');
    expectRejected(state, playAction(state, 'p2', 'jail', 'p2'), BangRuleCodes.InvalidTarget, 'p2');

    const jailed = play(state, 'p2', 'jail', 'p4');
    expect(inPlayOf(jailed, 'p4')).toEqual(['jail']);
    expect(handOf(jailed, 'p2')).toEqual([]);
  });

  it('costs its prisoner the turn unless a heart turns up', () => {
    const state = table([{}, { inPlay: ['jail'] }, {}, {}], { deckTop: [{ suit: 'clubs' }] });
    const skipped = endTurn(state, 'p1');
    expect(skipped.turn.playerId).toBe('p3');
    expect(player(skipped, 'p2').hand).toEqual([]);
    expect(inPlayOf(skipped, 'p2')).toEqual([]);
    expect(player(skipped, 'p3').hand).toHaveLength(2);
    expect(skipped.log.find((entry) => entry.type === 'CHECK')).toMatchObject({
      playerId: 'p2',
      reason: 'jail',
      passed: false,
    });
  });

  it('lets its prisoner out on a heart, and is discarded either way', () => {
    const state = table([{}, { inPlay: ['jail'] }, {}, {}], { deckTop: [{ suit: 'hearts' }] });
    const free = endTurn(state, 'p1');
    expect(free.turn).toMatchObject({ playerId: 'p2', step: 'PLAY' });
    expect(player(free, 'p2').hand).toHaveLength(2);
    expect(inPlayOf(free, 'p2')).toEqual([]);
    expect(free.discard.map((cardId) => free.cards[cardId]?.kind)).toContain('jail');
  });
});

describe('dynamite', () => {
  const lit = [{}, { inPlay: ['dynamite' as const] }, {}, {}];

  it('moves on to the next player when it does not go off', () => {
    const state = endTurn(table(lit, { deckTop: [{ suit: 'spades', rank: 10 }] }), 'p1');
    expect(inPlayOf(state, 'p2')).toEqual([]);
    expect(inPlayOf(state, 'p3')).toEqual(['dynamite']);
    expect(player(state, 'p2').life).toBe(4);
    expect(state.turn).toMatchObject({ playerId: 'p2', step: 'PLAY' });
    expect(player(state, 'p2').hand).toHaveLength(2);
  });

  it('goes off on a spade from 2 to 9, for three life points', () => {
    const state = endTurn(table(lit, { deckTop: [{ suit: 'spades', rank: 9 }] }), 'p1');
    expect(player(state, 'p2').life).toBe(1);
    expect(inPlayOf(state, 'p2')).toEqual([]);
    expect(state.discard.map((cardId) => state.cards[cardId]?.kind)).toContain('dynamite');
    expect(state.log.find((entry) => entry.type === 'HIT')).toMatchObject({
      playerId: 'p2',
      amount: 3,
      sourceId: null,
    });
    // The turn goes on for whoever survives it.
    expect(state.turn).toMatchObject({ playerId: 'p2', step: 'PLAY' });
    expect(player(state, 'p2').hand).toHaveLength(2);
  });

  it('does the damage the config says', () => {
    const config = configWith({ rules: { dynamiteDamage: 1 } });
    const state = endTurn(table(lit, { deckTop: [{ suit: 'spades', rank: 2 }], config }), 'p1');
    expect(player(state, 'p2').life).toBe(3);
  });

  it('passes the turn on when it kills', () => {
    const state = endTurn(
      table([{}, { life: 3, inPlay: ['dynamite'] }, {}, {}], {
        deckTop: [{ suit: 'spades', rank: 5 }],
      }),
      'p1',
    );
    expect(player(state, 'p2').alive).toBe(false);
    expect(state.turn.playerId).toBe('p3');
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p3']);
    expect(state.log.find((entry) => entry.type === 'DEATH')).toMatchObject({ killerId: null });
  });

  it('is checked before the jail', () => {
    const state = endTurn(
      table([{}, { inPlay: ['jail', 'dynamite'] }, {}, {}], {
        deckTop: [{ suit: 'spades', rank: 5 }, { suit: 'hearts' }],
      }),
      'p1',
    );
    expect(
      state.log.filter((entry) => entry.type === 'CHECK').map((entry) => entry.reason),
    ).toEqual(['dynamite', 'jail']);
    expect(player(state, 'p2').life).toBe(1);
    expect(state.turn).toMatchObject({ playerId: 'p2', step: 'PLAY' });
  });

  it('passes over a player who already has one', () => {
    const config = configWith({
      cards: [...engine.defaultConfig.cards, { kind: 'dynamite', suit: 'hearts', rank: 3 }],
    });
    const state = endTurn(
      table([{}, { inPlay: ['dynamite'] }, { alive: false }, { inPlay: ['dynamite'] }], {
        deckTop: [{ suit: 'hearts' }],
        config,
      }),
      'p1',
    );
    expect(inPlayOf(state, 'p2')).toEqual([]);
    expect(inPlayOf(state, 'p1')).toEqual(['dynamite']);
    expect(topOfDiscard(state)).not.toBe('dynamite');
  });
});
