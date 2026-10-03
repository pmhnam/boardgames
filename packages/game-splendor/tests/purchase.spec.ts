import { describe, expect, it } from 'vitest';
import { SplendorRuleCodes } from '../src/domain/errors.js';
import { getPayment, getShortfall } from '../src/rules/purchase.rules.js';
import {
  active,
  apply,
  expectRejected,
  gems,
  newGame,
  other,
  tokens,
  validate,
  withMarket,
  withPlayer,
  withPurchased,
} from './fixtures/states.js';

// white-L1-01 costs 3 blue; white-L1-06 costs 2 blue, 2 green, 1 black; red-L1-01 costs 3 white.
const CHEAP = 'white-L1-01';
const MIXED = 'white-L1-06';

describe('getPayment', () => {
  it('pays with gems of the right colours', () => {
    const wallet = { tokens: tokens({ blue: 3, red: 1 }), bonuses: gems() };
    expect(getPayment(wallet, gems({ blue: 3 }))).toEqual(tokens({ blue: 3 }));
  });

  it('takes bonuses off the cost first', () => {
    const wallet = { tokens: tokens({ blue: 3 }), bonuses: gems({ blue: 2 }) };
    expect(getPayment(wallet, gems({ blue: 3 }))).toEqual(tokens({ blue: 1 }));
  });

  it('pays nothing when bonuses cover the whole cost', () => {
    const wallet = { tokens: tokens({ blue: 3, gold: 2 }), bonuses: gems({ blue: 5 }) };
    expect(getPayment(wallet, gems({ blue: 3 }))).toEqual(tokens());
  });

  it('uses gold only for what is still short, across colours', () => {
    const wallet = { tokens: tokens({ blue: 1, green: 1, black: 1, gold: 2 }), bonuses: gems() };
    expect(getPayment(wallet, gems({ blue: 2, green: 2, black: 1 }))).toEqual(
      tokens({ blue: 1, green: 1, black: 1, gold: 2 }),
    );
  });

  it('is null when gold cannot cover the shortfall', () => {
    const wallet = { tokens: tokens({ blue: 1, gold: 1 }), bonuses: gems() };
    expect(getPayment(wallet, gems({ blue: 3 }))).toBeNull();
  });
});

describe('getShortfall', () => {
  it('lists what is missing per colour and lets gold cover the total', () => {
    const wallet = { tokens: tokens({ blue: 1, gold: 1 }), bonuses: gems({ green: 1 }) };
    expect(getShortfall(wallet, gems({ blue: 3, green: 2, black: 1 }))).toEqual({
      missing: gems({ blue: 2, green: 1, black: 1 }),
      short: 3,
    });
  });

  it('is zero exactly when the card can be paid for', () => {
    const cost = gems({ blue: 2, green: 2 });
    const able = { tokens: tokens({ blue: 1, green: 2, gold: 1 }), bonuses: gems() };
    const unable = { tokens: tokens({ blue: 1, green: 1, gold: 1 }), bonuses: gems() };
    expect(getShortfall(able, cost)).toEqual({ missing: gems({ blue: 1 }), short: 0 });
    expect(getPayment(able, cost)).not.toBeNull();
    expect(getShortfall(unable, cost).short).toBe(1);
    expect(getPayment(unable, cost)).toBeNull();
  });
});

describe('buying a face-up card', () => {
  it('pays the bank, keeps the card and refills the slot from the deck', () => {
    const base = withMarket(newGame(), [CHEAP]);
    const playerId = active(base);
    const state = withPlayer(base, playerId, { tokens: tokens({ blue: 3, red: 1 }) });
    const top = state.decks[1].at(-1);

    const next = apply(state, { type: 'BUY_CARD', cardId: CHEAP });

    expect(next.players[playerId]).toMatchObject({
      purchased: [CHEAP],
      tokens: tokens({ red: 1 }),
    });
    expect(next.bank.blue).toBe(state.bank.blue + 3);
    expect(next.market[1][0]).toBe(top);
    expect(next.decks[1]).toHaveLength(state.decks[1].length - 1);
    expect(active(next)).toBe(other(state));
  });

  it('spends gold on the shortfall and returns it to the bank', () => {
    const base = withMarket(newGame(), [MIXED]);
    const playerId = active(base);
    const state = withPlayer(base, playerId, {
      tokens: tokens({ blue: 1, green: 1, black: 1, gold: 2, red: 2 }),
    });

    const next = apply(state, { type: 'BUY_CARD', cardId: MIXED });

    expect(next.players[playerId]?.tokens).toEqual(tokens({ red: 2 }));
    expect(next.bank.gold).toBe(state.bank.gold + 2);
  });

  it('moves no tokens when bonuses cover the cost', () => {
    const blues = ['blue-L1-01', 'blue-L1-03', 'blue-L1-04'];
    const base = withMarket(withPurchased(newGame(), active(newGame()), blues), [CHEAP]);
    const playerId = active(base);
    const state = withPlayer(base, playerId, { tokens: tokens({ blue: 2 }) });

    const next = apply(state, { type: 'BUY_CARD', cardId: CHEAP });

    expect(next.players[playerId]?.tokens).toEqual(tokens({ blue: 2 }));
    expect(next.bank).toEqual(state.bank);
    expect(next.players[playerId]?.purchased).toEqual([...blues, CHEAP]);
  });

  it('leaves the slot empty once the deck has run out', () => {
    const base = withMarket(newGame(), [CHEAP]);
    const state = withPlayer({ ...base, decks: { ...base.decks, 1: [] } }, active(base), {
      tokens: tokens({ blue: 3 }),
    });
    const next = apply(state, { type: 'BUY_CARD', cardId: CHEAP });
    expect(next.market[1][0]).toBeNull();
    expect(next.market[1].slice(1)).toEqual(state.market[1].slice(1));
  });

  it('is refused without the means to pay', () => {
    const base = withMarket(newGame(), [CHEAP]);
    const state = withPlayer(base, active(base), { tokens: tokens({ blue: 2 }) });
    expectRejected(state, { type: 'BUY_CARD', cardId: CHEAP }, SplendorRuleCodes.CannotAfford);
  });
});

describe('buying a reserved card', () => {
  it('leaves the market untouched', () => {
    const base = newGame();
    const playerId = active(base);
    const cardId = base.decks[1].at(-1) as string;
    const state = withPlayer(
      { ...base, decks: { ...base.decks, 1: base.decks[1].slice(0, -1) } },
      playerId,
      {
        reserved: [{ cardId, blind: true }],
        tokens: tokens({ white: 4, blue: 4, green: 4, red: 4, black: 4, gold: 0 }),
      },
    );

    const next = apply(state, { type: 'BUY_CARD', cardId });

    expect(next.players[playerId]?.reserved).toEqual([]);
    expect(next.players[playerId]?.purchased).toEqual([cardId]);
    expect(next.market).toEqual(state.market);
    expect(next.decks).toEqual(state.decks);
  });
});

describe('cards a player may not touch', () => {
  it('answers the same for an unknown card, a deck card and an opponent’s reserve', () => {
    const base = newGame();
    const inDeck = base.decks[2].at(-1) as string;
    const hidden = base.decks[3].at(-1) as string;
    const state = withPlayer(
      { ...base, decks: { ...base.decks, 3: base.decks[3].slice(0, -1) } },
      other(base),
      { reserved: [{ cardId: hidden, blind: true }] },
    );
    const rich = withPlayer(state, active(state), {
      tokens: tokens({ white: 9, blue: 9, green: 9, red: 9, black: 9 }),
    });

    for (const type of ['BUY_CARD', 'RESERVE_CARD'] as const) {
      const answers = ['no-such-card', inDeck, hidden].map((cardId) =>
        validate(rich, { type, cardId }),
      );
      expect(answers[0]).toMatchObject({ valid: false, code: SplendorRuleCodes.CardNotAvailable });
      expect(answers[1]).toEqual(answers[0]);
      expect(answers[2]).toEqual(answers[0]);
    }
    // Being unable to pay must not give away more than being able to.
    expect(validate(state, { type: 'BUY_CARD', cardId: hidden })).toEqual(
      validate(rich, { type: 'BUY_CARD', cardId: hidden }),
    );
  });
});
