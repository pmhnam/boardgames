import { describe, expect, it } from 'vitest';
import { SplendorRuleCodes } from '../src/domain/errors.js';
import {
  active,
  apply,
  engine,
  expectRejected,
  newGame,
  other,
  tokens,
  withPlayer,
} from './fixtures/states.js';

const faceUp = (state: ReturnType<typeof newGame>, tier: 1 | 2 | 3, slot = 0) =>
  state.market[tier][slot] as string;

describe('reserving a face-up card', () => {
  it('takes the card and one gold, and refills the slot', () => {
    const state = newGame();
    const playerId = active(state);
    const cardId = faceUp(state, 2);
    const top = state.decks[2].at(-1);

    const next = apply(state, { type: 'RESERVE_CARD', cardId });

    expect(next.players[playerId]?.reserved).toEqual([{ cardId, blind: false }]);
    expect(next.players[playerId]?.tokens).toEqual(tokens({ gold: 1 }));
    expect(next.bank.gold).toBe(4);
    expect(next.market[2][0]).toBe(top);
    expect(active(next)).toBe(other(state));
  });

  it('still works, without gold, when the bank has none', () => {
    const state = newGame({ bank: tokens({ white: 4, blue: 4, green: 4, red: 4, black: 4 }) });
    const playerId = active(state);
    const next = apply(state, { type: 'RESERVE_CARD', cardId: faceUp(state, 1) });

    expect(next.players[playerId]?.reserved).toHaveLength(1);
    expect(next.players[playerId]?.tokens.gold).toBe(0);
    expect(next.bank.gold).toBe(0);
  });
});

describe('reserving from a deck', () => {
  it('takes the unseen top card', () => {
    const state = newGame();
    const playerId = active(state);
    const top = state.decks[3].at(-1) as string;

    const next = apply(state, { type: 'RESERVE_FROM_DECK', tier: 3 });

    expect(next.players[playerId]?.reserved).toEqual([{ cardId: top, blind: true }]);
    expect(next.players[playerId]?.tokens.gold).toBe(1);
    expect(next.decks[3]).toHaveLength(state.decks[3].length - 1);
    expect(next.market).toEqual(state.market);
  });

  it('is refused when the deck is empty', () => {
    const base = newGame();
    const state = { ...base, decks: { ...base.decks, 2: [] } };
    expectRejected(state, { type: 'RESERVE_FROM_DECK', tier: 2 }, SplendorRuleCodes.DeckEmpty);
  });

  it.each([0, 4, '1', undefined])('refuses tier %s', (tier) => {
    expect(engine.parseAction({ type: 'RESERVE_FROM_DECK', tier }).ok).toBe(false);
  });
});

describe('the reserve limit', () => {
  it('stops a fourth card, face up or unseen', () => {
    const base = newGame();
    const held = base.decks[1].slice(0, 3);
    const state = withPlayer(
      { ...base, decks: { ...base.decks, 1: base.decks[1].slice(3) } },
      active(base),
      { reserved: held.map((cardId) => ({ cardId, blind: true })) },
    );

    expectRejected(
      state,
      { type: 'RESERVE_CARD', cardId: faceUp(state, 1) },
      SplendorRuleCodes.ReserveLimitReached,
    );
    expectRejected(
      state,
      { type: 'RESERVE_FROM_DECK', tier: 1 },
      SplendorRuleCodes.ReserveLimitReached,
    );
  });
});

describe('reserving at the token limit', () => {
  it('makes the player give a token back, which may be the gold', () => {
    const base = newGame();
    const playerId = active(base);
    const state = withPlayer(base, playerId, {
      tokens: tokens({ white: 2, blue: 2, green: 2, red: 2, black: 2 }),
    });

    const reserved = apply(state, { type: 'RESERVE_CARD', cardId: faceUp(state, 1) });
    expect(reserved.turn).toMatchObject({ activePlayerId: playerId, step: 'RETURN_GEMS' });

    const returned = apply(reserved, { type: 'RETURN_GEMS', tokens: { gold: 1 } });
    expect(returned.players[playerId]?.tokens.gold).toBe(0);
    expect(returned.bank.gold).toBe(5);
    expect(active(returned)).toBe(other(state));
  });
});
