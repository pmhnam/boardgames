import { describe, expect, it } from 'vitest';
import { BangRuleCodes } from '../src/domain/errors.js';
import {
  apply,
  cardOf,
  endTurn,
  engine,
  expectRejected,
  handOf,
  legalFor,
  listAllCards,
  player,
  table,
} from './fixtures/states.js';

const FOUR = [{}, {}, {}, {}];

describe('a turn', () => {
  it('starts with two cards off the deck', () => {
    const state = endTurn(table(FOUR, { deckTop: ['beer', 'duel', 'bang'] }), 'p1');
    expect(state.turn).toMatchObject({ playerId: 'p2', step: 'PLAY', number: 2 });
    expect(handOf(state, 'p2')).toEqual(['beer', 'duel']);
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p2']);
  });

  it('passes round the table in seat order and back to the first seat', () => {
    let state = table(FOUR, { turn: 'p3' });
    state = endTurn(state, 'p3');
    expect(state.turn.playerId).toBe('p4');
    state = endTurn(state, 'p4');
    expect(state.turn.playerId).toBe('p1');
  });

  it('skips the eliminated', () => {
    const state = endTurn(table([{}, { alive: false }, { alive: false }, {}]), 'p1');
    expect(state.turn.playerId).toBe('p4');
  });

  it('is refused to anyone but the player it belongs to', () => {
    const state = table([{}, { hand: ['beer'] }, {}, {}]);
    expectRejected(state, { type: 'END_TURN', discardIds: [] }, BangRuleCodes.NotYourTurn, 'p2');
    expectRejected(
      state,
      {
        type: 'PLAY_CARD',
        cardId: cardOf(state, 'p2', 'beer'),
        targetId: null,
        targetCardId: null,
      },
      BangRuleCodes.NotYourTurn,
      'p2',
    );
    expectRejected(state, { type: 'END_TURN', discardIds: [] }, BangRuleCodes.NotYourTurn, 'px');
  });

  it('only takes the actions a turn is made of', () => {
    const state = table([{ hand: ['bang', 'bang'] }, {}, {}, {}]);
    const cardIds = player(state, 'p1').hand;
    expectRejected(state, { type: 'RESPOND', cardId: null }, BangRuleCodes.WrongAction, 'p1');
    expectRejected(state, { type: 'PICK_CARDS', cardIds }, BangRuleCodes.WrongAction, 'p1');
    expectRejected(
      state,
      { type: 'DRAW', source: 'deck', targetId: null },
      BangRuleCodes.WrongAction,
      'p1',
    );
    expectRejected(
      state,
      { type: 'DISCARD_TO_HEAL', cardIds },
      BangRuleCodes.AbilityNotAvailable,
      'p1',
    );
  });

  it('refuses a card the player does not hold', () => {
    const state = table([{}, { hand: ['beer'] }, {}, {}]);
    expectRejected(
      state,
      {
        type: 'PLAY_CARD',
        cardId: cardOf(state, 'p2', 'beer'),
        targetId: null,
        targetCardId: null,
      },
      BangRuleCodes.CardNotInHand,
      'p1',
    );
  });
});

describe('the hand limit', () => {
  const state = table([{ life: 2, hand: ['bang', 'beer', 'duel', 'missed'] }, {}, {}, {}]);
  const [bang, beer, duel, missed] = player(state, 'p1').hand as [string, string, string, string];

  it('is the life points the player has left', () => {
    expect(legalFor(state, 'p1').discardCount).toBe(2);
    const next = apply(state, { type: 'END_TURN', discardIds: [duel, missed] }, 'p1');
    expect(handOf(next, 'p1')).toEqual(['bang', 'beer']);
    expect(next.discard.slice(-2)).toEqual([duel, missed]);
    expect(next.turn.playerId).toBe('p2');
  });

  it('must be met exactly, with cards from the hand', () => {
    const reject = (discardIds: string[]) =>
      expectRejected(state, { type: 'END_TURN', discardIds }, BangRuleCodes.InvalidCards, 'p1');
    reject([]);
    reject([bang]);
    reject([bang, beer, duel]);
    reject([bang, bang]);
    reject([bang, 'c-none']);
  });

  it('lets nobody throw away cards they could keep', () => {
    const within = table([{ hand: ['bang'] }, {}, {}, {}]);
    expectRejected(
      within,
      { type: 'END_TURN', discardIds: player(within, 'p1').hand },
      BangRuleCodes.InvalidCards,
      'p1',
    );
  });
});

describe('the deck', () => {
  it('is rebuilt from the discard pile when it runs out', () => {
    const state = table(FOUR, { deckTop: ['beer'], emptyDeck: true });
    const total = listAllCards(state).length;
    expect(state.deck).toHaveLength(1);

    const next = endTurn(state, 'p1');
    expect(player(next, 'p2').hand).toHaveLength(2);
    expect(handOf(next, 'p2')[0]).toBe('beer');
    expect(next.discard).toHaveLength(0);
    expect(next.deck).toHaveLength(total - 2);
    expect(new Set(listAllCards(next)).size).toBe(total);
  });

  it('shuffles the same way for the same match, and gives what it has when there is nothing', () => {
    const state = table(FOUR, { deckTop: ['beer'], emptyDeck: true });
    expect(endTurn(state, 'p1')).toEqual(endTurn(state, 'p1'));

    const bare = { ...state, deck: [], discard: [] };
    const next = endTurn(bare, 'p1');
    expect(next.turn).toMatchObject({ playerId: 'p2', step: 'PLAY' });
    expect(player(next, 'p2').hand).toHaveLength(0);
  });
});

describe('once the match is over', () => {
  it('nothing more is accepted', () => {
    const state = { ...table(FOUR), phase: 'FINISHED' as const };
    expectRejected(state, { type: 'END_TURN', discardIds: [] }, BangRuleCodes.GameNotPlaying, 'p1');
    expect(engine.getCurrentPlayerIds(state)).toEqual([]);
  });
});
