import { describe, expect, it } from 'vitest';
import { BangRuleCodes } from '../src/domain/errors.js';
import {
  apply,
  cardOf,
  configWith,
  engine,
  expectRejected,
  handOf,
  inPlayOf,
  kinds,
  legalFor,
  play,
  playAction,
  player,
  respond,
  table,
  topOfDiscard,
  viewFor,
} from './fixtures/states.js';

describe('BANG! and Missed!', () => {
  const state = table([{ hand: ['bang', 'bang'] }, { hand: ['missed', 'beer'] }, {}, {}]);

  it('waits on the target, who loses a life point by not answering', () => {
    const shot = play(state, 'p1', 'bang', 'p2');
    expect(engine.getCurrentPlayerIds(shot)).toEqual(['p2']);
    expect(viewFor(shot, 'p3').pending).toMatchObject({
      type: 'BANG',
      playerId: 'p2',
      sourceId: 'p1',
      missedNeeded: 1,
    });
    expect(legalFor(shot, 'p2')).toMatchObject({
      prompt: 'BANG',
      responses: [cardOf(shot, 'p2', 'missed')],
      canPass: true,
    });
    expect(topOfDiscard(shot)).toBe('bang');

    const hit = respond(shot, 'p2', null);
    expect(player(hit, 'p2').life).toBe(3);
    expect(handOf(hit, 'p2')).toEqual(['missed', 'beer']);
    expect(hit.pending).toEqual([]);
    expect(engine.getCurrentPlayerIds(hit)).toEqual(['p1']);
  });

  it('is cancelled by a Missed!, which is discarded', () => {
    const dodged = respond(play(state, 'p1', 'bang', 'p2'), 'p2', 'missed');
    expect(player(dodged, 'p2').life).toBe(4);
    expect(handOf(dodged, 'p2')).toEqual(['beer']);
    expect(kinds(dodged, dodged.discard)).toEqual(['bang', 'missed']);
    expect(engine.getCurrentPlayerIds(dodged)).toEqual(['p1']);
  });

  it('can only be answered by its target, with a Missed! they hold', () => {
    const shot = play(state, 'p1', 'bang', 'p2');
    expectRejected(shot, { type: 'RESPOND', cardId: null }, BangRuleCodes.NotYourTurn, 'p1');
    expectRejected(shot, { type: 'RESPOND', cardId: null }, BangRuleCodes.NotYourTurn, 'p3');
    expectRejected(
      shot,
      { type: 'RESPOND', cardId: cardOf(shot, 'p2', 'beer') },
      BangRuleCodes.CardNotPlayable,
      'p2',
    );
    expectRejected(
      shot,
      { type: 'RESPOND', cardId: cardOf(shot, 'p1', 'bang') },
      BangRuleCodes.CardNotInHand,
      'p2',
    );
    expectRejected(shot, { type: 'END_TURN', discardIds: [] }, BangRuleCodes.WrongAction, 'p2');
    expectRejected(shot, playAction(shot, 'p2', 'beer'), BangRuleCodes.WrongAction, 'p2');
  });

  it('lands at once on a target with no cards to answer with', () => {
    const shot = play(table([{ hand: ['bang'] }, {}, {}, {}]), 'p1', 'bang', 'p2');
    expect(player(shot, 'p2').life).toBe(3);
    expect(engine.getCurrentPlayerIds(shot)).toEqual(['p1']);
  });

  it('may be played once a turn', () => {
    const second = respond(play(state, 'p1', 'bang', 'p2'), 'p2', null);
    expect(second.turn.bangsPlayed).toBe(1);
    expect(legalFor(second, 'p1').plays).toEqual([]);
    expectRejected(second, playAction(second, 'p1', 'bang', 'p2'), BangRuleCodes.BangLimit, 'p1');
  });

  it('may be played again and again with a Volcanic', () => {
    const armed = table([{ hand: ['bang', 'bang'], inPlay: ['volcanic'] }, {}, {}, {}]);
    const twice = play(play(armed, 'p1', 'bang', 'p2'), 'p1', 'bang', 'p4');
    expect([player(twice, 'p2').life, player(twice, 'p4').life]).toEqual([3, 3]);
  });

  it('may be played as often as the config allows', () => {
    const config = configWith({ rules: { bangsPerTurn: 2 } });
    const loose = table([{ hand: ['bang', 'bang', 'bang'] }, {}, {}, {}], { config });
    const twice = play(play(loose, 'p1', 'bang', 'p2'), 'p1', 'bang', 'p2');
    expect(player(twice, 'p2').life).toBe(2);
    expectRejected(twice, playAction(twice, 'p1', 'bang', 'p2'), BangRuleCodes.BangLimit, 'p1');
  });

  it('keeps a Missed! for when it is needed', () => {
    const holder = table([{ hand: ['missed'] }, {}, {}, {}]);
    expect(legalFor(holder, 'p1').plays).toEqual([]);
    expectRejected(
      holder,
      playAction(holder, 'p1', 'missed', 'p2'),
      BangRuleCodes.CardNotPlayable,
      'p1',
    );
  });
});

describe('a barrel', () => {
  const seats = [
    { hand: ['bang' as const] },
    { hand: ['missed' as const], inPlay: ['barrel' as const] },
    {},
    {},
  ];

  it('stops the shot on a heart, without its owner lifting a finger', () => {
    const shot = play(table(seats, { deckTop: [{ suit: 'hearts' }] }), 'p1', 'bang', 'p2');
    expect(player(shot, 'p2').life).toBe(4);
    expect(handOf(shot, 'p2')).toEqual(['missed']);
    expect(engine.getCurrentPlayerIds(shot)).toEqual(['p1']);
    expect(shot.log.at(-1)).toMatchObject({ type: 'CHECK', reason: 'barrel', passed: true });
    // The card flipped is discarded.
    expect(shot.cards[shot.discard.at(-1) ?? '']?.suit).toBe('hearts');
  });

  it('leaves the shot to be answered on anything else', () => {
    const shot = play(table(seats, { deckTop: [{ suit: 'spades' }] }), 'p1', 'bang', 'p2');
    expect(shot.log.at(-1)).toMatchObject({ type: 'CHECK', reason: 'barrel', passed: false });
    expect(engine.getCurrentPlayerIds(shot)).toEqual(['p2']);
    expect(player(respond(shot, 'p2', 'missed'), 'p2').life).toBe(4);
  });
});

describe('beer', () => {
  it('gives back a life point', () => {
    const state = play(table([{ life: 2, hand: ['beer'] }, {}, {}, {}]), 'p1', 'beer');
    expect(player(state, 'p1').life).toBe(3);
    expect(topOfDiscard(state)).toBe('beer');
  });

  it('is no use at full life', () => {
    const state = table([{ hand: ['beer'] }, {}, {}, {}]);
    expect(legalFor(state, 'p1').plays).toEqual([]);
    expectRejected(state, playAction(state, 'p1', 'beer'), BangRuleCodes.NoEffect, 'p1');
  });

  it('is no use once only two players are left', () => {
    const state = table([{ life: 1, hand: ['beer'] }, { alive: false }, {}, { alive: false }]);
    expectRejected(state, playAction(state, 'p1', 'beer'), BangRuleCodes.NoEffect, 'p1');

    const config = configWith({ rules: { beerMinPlayers: 2 } });
    const allowed = table([{ life: 1, hand: ['beer'] }, { alive: false }, {}, { alive: false }], {
      config,
    });
    expect(player(play(allowed, 'p1', 'beer'), 'p1').life).toBe(2);
  });
});

describe('the cards that give', () => {
  it('saloon: a life point to everyone alive who is missing one', () => {
    const state = play(
      table([{ life: 3, hand: ['saloon'] }, { life: 1 }, {}, { alive: false }]),
      'p1',
      'saloon',
    );
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => player(state, id).life)).toEqual([4, 2, 4, 0]);
    expect(player(state, 'p4').alive).toBe(false);
  });

  it('stagecoach: two cards', () => {
    const state = play(
      table([{ hand: ['stagecoach'] }, {}, {}, {}], { deckTop: ['beer', 'duel'] }),
      'p1',
      'stagecoach',
    );
    expect(handOf(state, 'p1')).toEqual(['beer', 'duel']);
  });

  it('wells fargo: three cards', () => {
    const state = play(
      table([{ hand: ['wellsFargo'] }, {}, {}, {}], { deckTop: ['beer', 'duel', 'bang'] }),
      'p1',
      'wellsFargo',
    );
    expect(handOf(state, 'p1')).toEqual(['beer', 'duel', 'bang']);
  });
});

describe('general store', () => {
  const state = table([{}, { hand: ['generalStore'] }, { alive: false }, {}], {
    turn: 'p2',
    deckTop: ['beer', 'duel', 'gatling', 'bang'],
  });
  const open = play(state, 'p2', 'generalStore');

  it('lays out a card for each player alive, for all to see', () => {
    expect(viewFor(open, 'p4').pending).toMatchObject({
      type: 'STORE',
      playerId: 'p2',
      waitingIds: ['p4', 'p1'],
    });
    expect(viewFor(open, 'p4').pending?.cards.map((card) => card.kind)).toEqual([
      'beer',
      'duel',
      'gatling',
    ]);
    expect(handOf(open, 'p2')).toEqual([]);
  });

  it('has each take one in turn, starting with whoever played it', () => {
    expect(legalFor(open, 'p2')).toMatchObject({ prompt: 'STORE', pickCount: 1 });
    const [beer, duel, gatling] = legalFor(open, 'p2').picks as [string, string, string];

    const first = apply(open, { type: 'PICK_CARDS', cardIds: [gatling] }, 'p2');
    expect(handOf(first, 'p2')).toEqual(['gatling']);
    expect(engine.getCurrentPlayerIds(first)).toEqual(['p4']);

    // The last card needs no choosing.
    const done = apply(first, { type: 'PICK_CARDS', cardIds: [beer] }, 'p4');
    expect(handOf(done, 'p4')).toEqual(['beer']);
    expect(player(done, 'p1').hand).toEqual([duel]);
    expect(done.pending).toEqual([]);
    expect(engine.getCurrentPlayerIds(done)).toEqual(['p2']);
  });

  it('refuses a card that is not on offer, more than one, or a player out of turn', () => {
    const [beer, duel] = legalFor(open, 'p2').picks as [string, string];
    const reject = (cardIds: string[]) =>
      expectRejected(open, { type: 'PICK_CARDS', cardIds }, BangRuleCodes.InvalidCards, 'p2');
    reject([]);
    reject([beer, duel]);
    reject([open.deck.at(-1) ?? '']);
    expectRejected(open, { type: 'PICK_CARDS', cardIds: [beer] }, BangRuleCodes.NotYourTurn, 'p4');
  });
});

describe('panic! and cat balou', () => {
  const seats = [
    { hand: ['panic' as const, 'catBalou' as const] },
    { hand: ['beer' as const], inPlay: ['barrel' as const, 'mustang' as const] },
    {},
    { inPlay: ['scope' as const] },
  ];
  const state = table(seats);

  it('panic takes a card off the table into the hand', () => {
    const next = play(state, 'p1', 'panic', 'p4', 'scope');
    expect(handOf(next, 'p1')).toEqual(['catBalou', 'scope']);
    expect(inPlayOf(next, 'p4')).toEqual([]);
    expect(next.log.at(-1)).toMatchObject({ type: 'TAKE', fromHand: false, discarded: false });
  });

  it('panic takes a card unseen from the hand', () => {
    const next = play(
      table([{ hand: ['panic'] }, { hand: ['beer'] }, {}, {}]),
      'p1',
      'panic',
      'p2',
    );
    expect(handOf(next, 'p1')).toEqual(['beer']);
    expect(handOf(next, 'p2')).toEqual([]);
    expect(next.log.at(-1)).toMatchObject({ type: 'TAKE', fromHand: true, discarded: false });
  });

  it('cat balou discards a card, from anywhere at the table', () => {
    const far = table([{ hand: ['catBalou'] }, {}, { hand: ['beer'], inPlay: ['barrel'] }, {}]);
    const fromTable = play(far, 'p1', 'catBalou', 'p3', 'barrel');
    expect(inPlayOf(fromTable, 'p3')).toEqual([]);
    expect(topOfDiscard(fromTable)).toBe('barrel');

    const fromHand = play(far, 'p1', 'catBalou', 'p3');
    expect(handOf(fromHand, 'p3')).toEqual([]);
    expect(topOfDiscard(fromHand)).toBe('beer');
    expect(handOf(fromHand, 'p1')).toEqual([]);
  });

  it('are offered only against players with a card to lose', () => {
    const plays = legalFor(state, 'p1').plays;
    // The mustang puts p2 out of a Panic!'s reach.
    expect(plays.map((option) => option.targets)).toEqual([['p4'], ['p2', 'p4']]);
    expectRejected(
      state,
      playAction(state, 'p1', 'catBalou', 'p3'),
      BangRuleCodes.InvalidTarget,
      'p1',
    );
    expectRejected(state, playAction(state, 'p1', 'panic', 'p2'), BangRuleCodes.OutOfRange, 'p1');
  });

  it('refuse a card that is not there', () => {
    const cardId = cardOf(state, 'p1', 'catBalou');
    const take = (targetId: string, targetCardId: string | null) =>
      expectRejected(
        state,
        { type: 'PLAY_CARD', cardId, targetId, targetCardId },
        BangRuleCodes.InvalidCards,
        'p1',
      );
    // p4 has no hand; the barrel is p2's, and a card in a hand cannot be named.
    take('p4', null);
    take('p4', cardOf(state, 'p2', 'barrel'));
    take('p2', cardOf(state, 'p2', 'beer'));
  });
});

describe('duel', () => {
  const state = table([{ hand: ['duel', 'bang', 'bang'] }, {}, { hand: ['bang', 'beer'] }, {}]);
  const duel = play(state, 'p1', 'duel', 'p3');

  it('can be fought with anyone, and is lost by whoever does not discard a BANG!', () => {
    expect(legalFor(state, 'p1').plays[0]?.targets).toEqual(['p2', 'p3', 'p4']);
    expect(viewFor(duel, 'p2').pending).toMatchObject({
      type: 'DUEL',
      playerId: 'p3',
      sourceId: 'p1',
    });
    expect(legalFor(duel, 'p3')).toMatchObject({
      prompt: 'DUEL',
      responses: [cardOf(duel, 'p3', 'bang')],
    });

    const lost = respond(duel, 'p3', null);
    expect(player(lost, 'p3').life).toBe(3);
    expect(engine.getCurrentPlayerIds(lost)).toEqual(['p1']);
  });

  it('goes back and forth until one of them gives in', () => {
    const back = respond(duel, 'p3', 'bang');
    expect(engine.getCurrentPlayerIds(back)).toEqual(['p1']);
    expect(viewFor(back, 'p2').pending).toMatchObject({
      type: 'DUEL',
      playerId: 'p1',
      sourceId: 'p3',
    });

    // p3 has no BANG! left, only a beer: they still get to say so.
    const again = respond(back, 'p1', 'bang');
    expect(engine.getCurrentPlayerIds(again)).toEqual(['p3']);
    expect(legalFor(again, 'p3').responses).toEqual([]);
    expect(player(respond(again, 'p3', null), 'p3').life).toBe(3);

    const given = respond(back, 'p1', null);
    expect(player(given, 'p1').life).toBe(3);
    expect(player(given, 'p3').life).toBe(4);
  });

  it('is lost at once by a player with no cards, and costs no BANG! of the turn', () => {
    const quick = play(state, 'p1', 'duel', 'p2');
    expect(player(quick, 'p2').life).toBe(3);
    expect(quick.turn.bangsPlayed).toBe(0);
    expect(legalFor(quick, 'p1').plays.map((option) => option.targets)).toEqual([
      ['p2', 'p4'],
      ['p2', 'p4'],
    ]);
  });

  it('is not answered with a Missed!', () => {
    const wrong = play(
      table([{ hand: ['duel'] }, { hand: ['missed'] }, {}, {}]),
      'p1',
      'duel',
      'p2',
    );
    expectRejected(
      wrong,
      { type: 'RESPOND', cardId: cardOf(wrong, 'p2', 'missed') },
      BangRuleCodes.CardNotPlayable,
      'p2',
    );
  });
});

describe('gatling', () => {
  const state = table(
    [
      { hand: ['missed'] },
      { hand: ['gatling', 'bang'] },
      { hand: ['missed'] },
      { alive: false },
      { hand: ['beer'] },
    ],
    { turn: 'p2' },
  );
  const fired = play(state, 'p2', 'gatling');

  it('shoots at everyone else in turn order', () => {
    expect(viewFor(fired, 'p1').pending).toMatchObject({
      type: 'BANG',
      playerId: 'p3',
      sourceId: 'p2',
      waitingIds: ['p5', 'p1'],
    });
    const third = respond(respond(fired, 'p3', 'missed'), 'p5', null);
    expect(engine.getCurrentPlayerIds(third)).toEqual(['p1']);
    const done = respond(third, 'p1', 'missed');

    expect(['p1', 'p2', 'p3', 'p5'].map((id) => player(done, id).life)).toEqual([4, 4, 4, 3]);
    expect(done.pending).toEqual([]);
    expect(engine.getCurrentPlayerIds(done)).toEqual(['p2']);
  });

  it('is not the BANG! of the turn', () => {
    expect(fired.turn.bangsPlayed).toBe(0);
  });
});

describe('indians!', () => {
  const state = table([{ hand: ['indians'] }, { hand: ['bang'] }, { hand: ['missed'] }, {}]);
  const raid = play(state, 'p1', 'indians');

  it('costs everyone else a BANG! or a life point', () => {
    expect(viewFor(raid, 'p4').pending).toMatchObject({
      type: 'INDIANS',
      playerId: 'p2',
      sourceId: 'p1',
      waitingIds: ['p3', 'p4'],
    });
    const second = respond(raid, 'p2', 'bang');
    expect(legalFor(second, 'p3')).toMatchObject({ prompt: 'INDIANS', responses: [] });
    // p4 has no cards and is hit without being asked.
    const done = respond(second, 'p3', null);
    expect(['p1', 'p2', 'p3', 'p4'].map((id) => player(done, id).life)).toEqual([4, 4, 3, 3]);
    expect(engine.getCurrentPlayerIds(done)).toEqual(['p1']);
  });

  it('is not held off by a barrel or a Missed!', () => {
    const walled = play(
      table([{ hand: ['indians'] }, { hand: ['missed'], inPlay: ['barrel'] }, {}, {}], {
        deckTop: [{ suit: 'hearts' }],
      }),
      'p1',
      'indians',
    );
    expect(walled.log.some((entry) => entry.type === 'CHECK')).toBe(false);
    expectRejected(
      walled,
      { type: 'RESPOND', cardId: cardOf(walled, 'p2', 'missed') },
      BangRuleCodes.CardNotPlayable,
      'p2',
    );
  });
});

describe('cards that stay on the table', () => {
  it('go in front of whoever plays them', () => {
    let state = table([{ hand: ['barrel', 'mustang', 'scope', 'dynamite'] }, {}, {}, {}]);
    for (const kind of ['barrel', 'mustang', 'scope', 'dynamite'] as const) {
      state = play(state, 'p1', kind);
    }
    expect(inPlayOf(state, 'p1')).toEqual(['barrel', 'mustang', 'scope', 'dynamite']);
    expect(state.discard).toEqual([]);
    expect(viewFor(state, 'p3').players[0]?.inPlay.map((card) => card.kind)).toEqual([
      'barrel',
      'mustang',
      'scope',
      'dynamite',
    ]);
  });

  it('cannot be doubled up', () => {
    const state = table([{ hand: ['barrel'], inPlay: ['barrel'] }, {}, {}, {}]);
    expect(legalFor(state, 'p1').plays).toEqual([]);
    expectRejected(state, playAction(state, 'p1', 'barrel'), BangRuleCodes.AlreadyInPlay, 'p1');
  });

  it('a weapon replaces the one before it', () => {
    const state = table([{ hand: ['winchester'], inPlay: ['schofield', 'barrel'] }, {}, {}, {}]);
    const next = apply(state, playAction(state, 'p1', 'winchester'), 'p1');
    expect(inPlayOf(next, 'p1')).toEqual(['barrel', 'winchester']);
    expect(topOfDiscard(next)).toBe('schofield');
  });
});
