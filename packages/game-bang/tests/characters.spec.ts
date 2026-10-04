import { describe, expect, it } from 'vitest';
import { BangRuleCodes } from '../src/domain/errors.js';
import {
  apply,
  cardOf,
  endTurn,
  engine,
  expectRejected,
  handOf,
  kinds,
  legalFor,
  listAllCards,
  play,
  playAction,
  player,
  respond,
  table,
  topOfDiscard,
  viewFor,
} from './fixtures/states.js';

describe('Bart Cassidy', () => {
  it('draws a card for each life point lost', () => {
    const shot = play(
      table([{ hand: ['bang'] }, { character: 'bartCassidy' }, {}, {}], { deckTop: ['beer'] }),
      'p1',
      'bang',
      'p2',
    );
    expect(player(shot, 'p2').life).toBe(3);
    expect(handOf(shot, 'p2')).toEqual(['beer']);

    const blown = endTurn(
      table([{}, { character: 'bartCassidy', inPlay: ['dynamite'] }, {}, {}], {
        deckTop: [{ suit: 'spades', rank: 3 }, 'beer', 'duel', 'bang'],
      }),
      'p1',
    );
    expect(handOf(blown, 'p2').slice(0, 3)).toEqual(['beer', 'duel', 'bang']);
    expect(player(blown, 'p2').hand).toHaveLength(5);
  });

  it('draws nothing for the wound that kills him', () => {
    const shot = play(
      table([{ hand: ['bang'] }, { character: 'bartCassidy', life: 1 }, {}, {}]),
      'p1',
      'bang',
      'p2',
    );
    expect(player(shot, 'p2')).toMatchObject({ alive: false, hand: [] });
  });
});

describe('Black Jack', () => {
  const seats = [{}, { character: 'blackJack' as const }, {}, {}];

  it('shows the second card he draws, and draws a third on a heart or a diamond', () => {
    const state = endTurn(
      table(seats, { deckTop: ['missed', { kind: 'bang', suit: 'diamonds' }, 'duel'] }),
      'p1',
    );
    expect(handOf(state, 'p2')).toEqual(['missed', 'bang', 'duel']);
    expect(viewFor(state, 'p4').log.at(-1)).toMatchObject({
      type: 'DRAW',
      playerId: 'p2',
      count: 3,
      shown: { kind: 'bang', suit: 'diamonds' },
    });
  });

  it('draws no third on a club or a spade', () => {
    const state = endTurn(
      table(seats, { deckTop: ['beer', { kind: 'bang', suit: 'clubs' }, 'duel'] }),
      'p1',
    );
    expect(handOf(state, 'p2')).toEqual(['beer', 'bang']);
  });
});

describe('Calamity Janet', () => {
  it('plays a Missed! as a BANG!', () => {
    const state = table([{ character: 'calamityJanet', hand: ['missed', 'missed'] }, {}, {}, {}]);
    expect(legalFor(state, 'p1').plays.map((option) => option.targets)).toEqual([
      ['p2', 'p4'],
      ['p2', 'p4'],
    ]);
    const shot = play(state, 'p1', 'missed', 'p2');
    expect(player(shot, 'p2').life).toBe(3);
    // It is her BANG! of the turn.
    expectRejected(shot, playAction(shot, 'p1', 'missed', 'p4'), BangRuleCodes.BangLimit, 'p1');
  });

  it('answers a BANG! with a BANG!', () => {
    const shot = play(
      table([{ hand: ['bang'] }, { character: 'calamityJanet', hand: ['bang', 'beer'] }, {}, {}]),
      'p1',
      'bang',
      'p2',
    );
    expect(legalFor(shot, 'p2').responses).toEqual([cardOf(shot, 'p2', 'bang')]);
    expect(player(respond(shot, 'p2', 'bang'), 'p2').life).toBe(4);
  });

  it('answers a duel and the Indians with a Missed!', () => {
    const seats = [
      { hand: ['duel' as const, 'indians' as const] },
      { character: 'calamityJanet' as const, hand: ['missed' as const] },
      {},
      {},
    ];
    const duel = respond(play(table(seats), 'p1', 'duel', 'p2'), 'p2', 'missed');
    expect(engine.getCurrentPlayerIds(duel)).toEqual(['p1']);
    expect(duel.pending[0]).toMatchObject({ type: 'DUEL', playerId: 'p1' });

    const raid = respond(play(table(seats), 'p1', 'indians'), 'p2', 'missed');
    expect(player(raid, 'p2').life).toBe(4);
  });
});

describe('El Gringo', () => {
  it('takes a card from the hand of whoever costs him a life point', () => {
    const shot = play(
      table([{ hand: ['bang', 'beer'] }, { character: 'elGringo' }, {}, {}]),
      'p1',
      'bang',
      'p2',
    );
    expect(handOf(shot, 'p2')).toEqual(['beer']);
    expect(handOf(shot, 'p1')).toEqual([]);
    expect(shot.log.at(-1)).toMatchObject({ type: 'TAKE', playerId: 'p2', fromId: 'p1' });
  });

  it('takes nothing from an empty hand, or for a dynamite', () => {
    const shot = play(
      table([{ hand: ['bang'] }, { character: 'elGringo' }, {}, {}]),
      'p1',
      'bang',
      'p2',
    );
    expect(player(shot, 'p2')).toMatchObject({ life: 3, hand: [] });

    const blown = endTurn(
      table([{ hand: ['beer'] }, { character: 'elGringo', inPlay: ['dynamite'] }, {}, {}], {
        deckTop: [{ suit: 'spades', rank: 3 }],
      }),
      'p1',
    );
    expect(handOf(blown, 'p1')).toEqual(['beer']);
  });
});

describe('Jesse Jones', () => {
  const state = endTurn(
    table([{ hand: ['gatling'] }, { character: 'jesseJones' }, {}, { hand: ['beer'] }], {
      deckTop: ['duel', 'bang'],
    }),
    'p1',
  );

  it('chooses where his first card comes from', () => {
    expect(state.turn.playerId).toBe('p2');
    expect(legalFor(state, 'p2')).toMatchObject({
      prompt: 'DRAW',
      drawFromDiscard: false,
      drawFromPlayers: ['p4', 'p1'],
    });
    expect(viewFor(state, 'p3').pending).toMatchObject({ type: 'DRAW', playerId: 'p2' });
  });

  it('may take it from another player, unseen', () => {
    const next = apply(state, { type: 'DRAW', source: 'player', targetId: 'p1' }, 'p2');
    expect(handOf(next, 'p2')).toEqual(['gatling', 'duel']);
    expect(handOf(next, 'p1')).toEqual([]);
    expect(engine.getCurrentPlayerIds(next)).toEqual(['p2']);
    expect(legalFor(next, 'p2').prompt).toBe('PLAY');
  });

  it('may just draw two', () => {
    const next = apply(state, { type: 'DRAW', source: 'deck', targetId: null }, 'p2');
    expect(handOf(next, 'p2')).toEqual(['duel', 'bang']);
  });

  it('cannot take from an empty hand, the discard pile, or himself', () => {
    const reject = (action: Parameters<typeof apply>[1], code: string) =>
      expectRejected(state, action, code, 'p2');
    reject({ type: 'DRAW', source: 'player', targetId: 'p3' }, BangRuleCodes.InvalidTarget);
    reject({ type: 'DRAW', source: 'player', targetId: 'p2' }, BangRuleCodes.InvalidTarget);
    reject({ type: 'DRAW', source: 'player', targetId: null }, BangRuleCodes.InvalidTarget);
    reject({ type: 'DRAW', source: 'discard', targetId: null }, BangRuleCodes.AbilityNotAvailable);
    reject({ type: 'END_TURN', discardIds: [] }, BangRuleCodes.WrongAction);
  });

  it('is not asked when nobody else holds a card', () => {
    const alone = endTurn(table([{}, { character: 'jesseJones' }, {}, {}]), 'p1');
    expect(legalFor(alone, 'p2').prompt).toBe('PLAY');
    expect(player(alone, 'p2').hand).toHaveLength(2);
  });
});

describe('Jourdonnais', () => {
  const seats = [
    { hand: ['bang' as const] },
    { character: 'jourdonnais' as const, hand: ['missed' as const] },
    {},
    {},
  ];

  it('has a barrel without holding one', () => {
    const shot = play(table(seats, { deckTop: [{ suit: 'hearts' }] }), 'p1', 'bang', 'p2');
    expect(engine.getCurrentPlayerIds(shot)).toEqual(['p1']);
    expect(handOf(shot, 'p2')).toEqual(['missed']);
  });

  it('gets a second try with a real one', () => {
    const armed = [seats[0] ?? {}, { ...seats[1], inPlay: ['barrel' as const] }, {}, {}];
    const shot = play(
      table(armed, { deckTop: [{ suit: 'clubs' }, { suit: 'hearts' }] }),
      'p1',
      'bang',
      'p2',
    );
    expect(shot.log.filter((entry) => entry.type === 'CHECK')).toHaveLength(2);
    expect(engine.getCurrentPlayerIds(shot)).toEqual(['p1']);
    expect(player(shot, 'p2').life).toBe(4);
  });
});

describe('Kit Carlson', () => {
  const state = endTurn(
    table([{}, { character: 'kitCarlson' }, {}, {}], { deckTop: ['beer', 'duel', 'gatling'] }),
    'p1',
  );

  it('looks at three cards, which nobody else sees', () => {
    expect(legalFor(state, 'p2')).toMatchObject({ prompt: 'KIT', pickCount: 2 });
    expect(viewFor(state, 'p2').pending?.cards.map((card) => card.kind)).toEqual([
      'beer',
      'duel',
      'gatling',
    ]);
    expect(viewFor(state, 'p3').pending).toMatchObject({ type: 'KIT', playerId: 'p2', cards: [] });
    expect(new Set(listAllCards(state)).size).toBe(Object.keys(state.cards).length);
  });

  it('keeps two and puts the third back on the deck', () => {
    const [beer, duel, gatling] = legalFor(state, 'p2').picks as [string, string, string];
    const next = apply(state, { type: 'PICK_CARDS', cardIds: [gatling, beer] }, 'p2');
    expect(handOf(next, 'p2')).toEqual(['gatling', 'beer']);
    expect(next.deck.at(-1)).toBe(duel);
    expect(legalFor(next, 'p2').prompt).toBe('PLAY');
  });

  it('must keep exactly two of those three', () => {
    const [beer, duel, gatling] = legalFor(state, 'p2').picks as [string, string, string];
    const reject = (cardIds: string[]) =>
      expectRejected(state, { type: 'PICK_CARDS', cardIds }, BangRuleCodes.InvalidCards, 'p2');
    reject([beer]);
    reject([beer, duel, gatling]);
    reject([beer, beer]);
    reject([beer, state.deck.at(-1) ?? '']);
  });
});

describe('Lucky Duke', () => {
  it('flips two cards for a "draw!" and is judged on the better', () => {
    const shot = play(
      table([{ hand: ['bang'] }, { character: 'luckyDuke', inPlay: ['barrel'] }, {}, {}], {
        deckTop: [{ suit: 'spades' }, { suit: 'hearts' }, 'gatling'],
      }),
      'p1',
      'bang',
      'p2',
    );
    expect(shot.log.at(-1)).toMatchObject({ type: 'CHECK', passed: true });
    expect(shot.log.at(-1)).toHaveProperty('cardIds.length', 2);
    expect(player(shot, 'p2').life).toBe(4);
    // Both go to the discard pile.
    expect(shot.discard).toHaveLength(3);
    expect(kinds(shot, shot.deck.slice(-1))).toEqual(['gatling']);
  });

  it('escapes a dynamite if either card is safe', () => {
    const state = endTurn(
      table([{}, { character: 'luckyDuke', inPlay: ['dynamite'] }, {}, {}], {
        deckTop: [
          { suit: 'spades', rank: 3 },
          { suit: 'spades', rank: 10 },
        ],
      }),
      'p1',
    );
    expect(player(state, 'p2').life).toBe(4);
  });
});

describe('Sid Ketchum', () => {
  const hurt = table([
    { character: 'sidKetchum', life: 2, hand: ['bang', 'duel', 'missed'] },
    {},
    {},
    {},
  ]);

  it('discards two cards for a life point, as often as he can pay', () => {
    expect(legalFor(hurt, 'p1').canHeal).toBe(true);
    const [bang, duel] = player(hurt, 'p1').hand as [string, string];
    const next = apply(hurt, { type: 'DISCARD_TO_HEAL', cardIds: [bang, duel] }, 'p1');
    expect(player(next, 'p1').life).toBe(3);
    expect(handOf(next, 'p1')).toEqual(['missed']);
    expect(next.discard).toEqual([bang, duel]);
    expect(legalFor(next, 'p1').canHeal).toBe(false);
    expect(next.turn.playerId).toBe('p1');
  });

  it('needs exactly two cards of his own, and a life point to regain', () => {
    const [bang, duel, missed] = player(hurt, 'p1').hand as [string, string, string];
    const reject = (cardIds: string[]) =>
      expectRejected(hurt, { type: 'DISCARD_TO_HEAL', cardIds }, BangRuleCodes.InvalidCards, 'p1');
    reject([bang]);
    reject([bang, duel, missed]);
    reject([bang, bang]);
    reject([bang, 'c-none']);

    const well = table([{ character: 'sidKetchum', hand: ['bang', 'duel'] }, {}, {}, {}]);
    expectRejected(
      well,
      { type: 'DISCARD_TO_HEAL', cardIds: player(well, 'p1').hand },
      BangRuleCodes.AbilityNotAvailable,
      'p1',
    );
  });

  it('may do so when he is shot at, before answering', () => {
    const shot = play(
      table([
        { hand: ['bang'] },
        { character: 'sidKetchum', life: 1, hand: ['duel', 'beer'] },
        {},
        {},
      ]),
      'p1',
      'bang',
      'p2',
    );
    const healed = apply(shot, { type: 'DISCARD_TO_HEAL', cardIds: player(shot, 'p2').hand }, 'p2');
    // Up to two, and with no cards left the shot then lands by itself.
    expect(player(healed, 'p2')).toMatchObject({ life: 1, alive: true, hand: [] });
    expect(kinds(healed, healed.discard)).toEqual(['bang', 'duel', 'beer']);
    expect(engine.getCurrentPlayerIds(healed)).toEqual(['p1']);
  });

  it('is asked before he dies whether to buy his life back', () => {
    const shot = respond(
      play(
        table([
          { hand: ['bang'] },
          { role: 'outlaw', character: 'sidKetchum', life: 1, hand: ['duel', 'missed', 'scope'] },
          {},
          {},
        ]),
        'p1',
        'bang',
        'p2',
      ),
      'p2',
      null,
    );
    expect(player(shot, 'p2')).toMatchObject({ alive: true, life: 0 });
    expect(legalFor(shot, 'p2')).toMatchObject({ prompt: 'DYING', canHeal: true, canPass: true });
    expect(viewFor(shot, 'p3').pending).toMatchObject({
      type: 'DYING',
      playerId: 'p2',
      sourceId: 'p1',
    });

    const [duel, missed] = player(shot, 'p2').hand as [string, string];
    const saved = apply(shot, { type: 'DISCARD_TO_HEAL', cardIds: [duel, missed] }, 'p2');
    expect(player(saved, 'p2')).toMatchObject({ alive: true, life: 1 });
    expect(saved.pending).toEqual([]);
    expect(engine.getCurrentPlayerIds(saved)).toEqual(['p1']);

    const gone = respond(shot, 'p2', null);
    expect(player(gone, 'p2').alive).toBe(false);
    // The sheriff collects on the outlaw.
    expect(player(gone, 'p1').hand).toHaveLength(3);
  });

  it('is not asked when he has not the cards for it', () => {
    const shot = respond(
      play(
        table([{ hand: ['bang'] }, { character: 'sidKetchum', life: 1, hand: ['duel'] }, {}, {}]),
        'p1',
        'bang',
        'p2',
      ),
      'p2',
      null,
    );
    expect(player(shot, 'p2').alive).toBe(false);
  });

  it('drinks his beers first and pays for the rest', () => {
    const blown = endTurn(
      table(
        [
          {},
          {
            character: 'sidKetchum',
            life: 2,
            hand: ['beer', 'duel', 'bang'],
            inPlay: ['dynamite'],
          },
          {},
          {},
        ],
        { deckTop: [{ suit: 'spades', rank: 3 }] },
      ),
      'p1',
    );
    // Three damage from two life: the beer brings him to zero, two cards to one.
    expect(player(blown, 'p2')).toMatchObject({ alive: true, life: 0 });
    expect(handOf(blown, 'p2')).toEqual(['duel', 'bang']);
    const saved = apply(
      blown,
      { type: 'DISCARD_TO_HEAL', cardIds: player(blown, 'p2').hand },
      'p2',
    );
    expect(player(saved, 'p2')).toMatchObject({ alive: true, life: 1 });
    // His turn then goes on as usual.
    expect(saved.turn).toMatchObject({ playerId: 'p2', step: 'PLAY' });
    expect(player(saved, 'p2').hand).toHaveLength(2);
  });
});

describe('Slab the Killer', () => {
  const seats = [
    { character: 'slabTheKiller' as const, hand: ['bang' as const, 'gatling' as const] },
    { hand: ['missed' as const, 'missed' as const] },
    {},
    {},
  ];

  it('takes two Missed! to dodge', () => {
    const shot = play(table(seats), 'p1', 'bang', 'p2');
    expect(viewFor(shot, 'p3').pending?.missedNeeded).toBe(2);
    const once = respond(shot, 'p2', 'missed');
    expect(engine.getCurrentPlayerIds(once)).toEqual(['p2']);
    expect(viewFor(once, 'p3').pending?.missedNeeded).toBe(1);
    expect(player(respond(once, 'p2', 'missed'), 'p2')).toMatchObject({ life: 4, hand: [] });
    // One is not enough.
    expect(player(respond(once, 'p2', null), 'p2').life).toBe(3);
  });

  it('counts a barrel as one of the two', () => {
    const walled = [
      seats[0] ?? {},
      { hand: ['missed' as const], inPlay: ['barrel' as const] },
      {},
      {},
    ];
    const shot = play(table(walled, { deckTop: [{ suit: 'hearts' }] }), 'p1', 'bang', 'p2');
    expect(viewFor(shot, 'p3').pending?.missedNeeded).toBe(1);
    expect(player(respond(shot, 'p2', 'missed'), 'p2').life).toBe(4);
  });

  it('shoots a Gatling like anyone else', () => {
    const fired = play(table(seats), 'p1', 'gatling');
    expect(viewFor(fired, 'p3').pending?.missedNeeded).toBe(1);
  });
});

describe('Suzy Lafayette', () => {
  it('draws a card as soon as her hand is empty', () => {
    const state = play(
      table([{ character: 'suzyLafayette', life: 3, hand: ['beer'] }, {}, {}, {}], {
        deckTop: ['duel'],
      }),
      'p1',
      'beer',
    );
    expect(handOf(state, 'p1')).toEqual(['duel']);
    expect(state.log.at(-1)).toMatchObject({ type: 'DRAW', playerId: 'p1', count: 1 });
  });

  it("on anyone's turn", () => {
    const shot = respond(
      play(
        table([{ hand: ['bang'] }, { character: 'suzyLafayette', hand: ['missed'] }, {}, {}], {
          deckTop: ['duel'],
        }),
        'p1',
        'bang',
        'p2',
      ),
      'p2',
      'missed',
    );
    expect(handOf(shot, 'p2')).toEqual(['duel']);
  });

  it('but not in the middle of a duel', () => {
    const duel = play(
      table([{ hand: ['duel'] }, { character: 'suzyLafayette', hand: ['bang'] }, {}, {}], {
        deckTop: ['bang', 'gatling'],
      }),
      'p1',
      'duel',
      'p2',
    );
    // Her BANG! empties her hand; the sheriff, with no cards, loses; then she draws.
    const done = respond(duel, 'p2', 'bang');
    expect(player(done, 'p1').life).toBe(3);
    expect(handOf(done, 'p2')).toEqual(['bang']);
    expect(done.pending).toEqual([]);
  });
});

describe('Vulture Sam', () => {
  it('takes the cards of anyone eliminated', () => {
    const state = table([
      { hand: ['bang'] },
      { role: 'renegade', life: 1, hand: ['duel'], inPlay: ['scope'] },
      { character: 'vultureSam', hand: ['beer'] },
      {},
    ]);
    const dead = respond(play(state, 'p1', 'bang', 'p2'), 'p2', null);
    expect(handOf(dead, 'p3')).toEqual(['beer', 'duel', 'scope']);
    expect(kinds(dead, dead.discard)).toEqual(['bang']);
    expect(dead.log.at(-1)).toMatchObject({ type: 'DEATH', lootedById: 'p3' });
  });

  it('leaves his own to the discard pile', () => {
    const state = table([
      { hand: ['bang'] },
      { role: 'renegade', character: 'vultureSam', life: 1, hand: ['duel'] },
      {},
      {},
    ]);
    const dead = respond(play(state, 'p1', 'bang', 'p2'), 'p2', null);
    expect(topOfDiscard(dead)).toBe('duel');
    expect(dead.log.at(-1)).toMatchObject({ type: 'DEATH', lootedById: null });
  });
});

describe('Willy the Kid', () => {
  it('plays as many BANG! cards as he likes', () => {
    const state = table([{ character: 'willyTheKid', hand: ['bang', 'bang', 'bang'] }, {}, {}, {}]);
    const thrice = play(
      play(play(state, 'p1', 'bang', 'p2'), 'p1', 'bang', 'p2'),
      'p1',
      'bang',
      'p4',
    );
    expect([player(thrice, 'p2').life, player(thrice, 'p4').life]).toEqual([2, 3]);
  });
});

describe('Pedro Ramirez', () => {
  const state = endTurn(
    table([{ hand: ['beer'] }, { character: 'pedroRamirez' }, {}, {}], {
      deckTop: ['duel', 'bang'],
      discard: ['missed', 'gatling'],
    }),
    'p1',
  );

  it('may take his first card from the top of the discard pile', () => {
    expect(legalFor(state, 'p2')).toMatchObject({
      prompt: 'DRAW',
      drawFromDiscard: true,
      drawFromPlayers: [],
    });
    const next = apply(state, { type: 'DRAW', source: 'discard', targetId: null }, 'p2');
    expect(handOf(next, 'p2')).toEqual(['gatling', 'duel']);
    expect(topOfDiscard(next)).toBe('missed');
    expect(viewFor(next, 'p4').log.at(-1)).toMatchObject({
      type: 'DRAW',
      from: 'discard',
      shown: { kind: 'gatling' },
    });
  });

  it('may just draw two, and cannot draw from a hand', () => {
    const next = apply(state, { type: 'DRAW', source: 'deck', targetId: null }, 'p2');
    expect(handOf(next, 'p2')).toEqual(['duel', 'bang']);
    expectRejected(
      state,
      { type: 'DRAW', source: 'player', targetId: 'p1' },
      BangRuleCodes.InvalidTarget,
      'p2',
    );
  });

  it('is not asked when the discard pile is empty', () => {
    const empty = endTurn(table([{}, { character: 'pedroRamirez' }, {}, {}]), 'p1');
    expect(legalFor(empty, 'p2').prompt).toBe('PLAY');
    expect(player(empty, 'p2').hand).toHaveLength(2);
  });
});
