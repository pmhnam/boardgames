import { describe, expect, it } from 'vitest';
import { SplendorRuleCodes } from '../src/domain/errors.js';
import { countTokens } from '../src/domain/gems.js';
import { getTakeCount, validateTakeGems } from '../src/rules/gems.rules.js';
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

describe('taking three different gems', () => {
  it('moves one gem of each colour from the bank and passes the turn', () => {
    const state = newGame();
    const playerId = active(state);
    const next = apply(state, { type: 'TAKE_GEMS', colors: ['white', 'blue', 'red'] });

    expect(next.players[playerId]?.tokens).toEqual(tokens({ white: 1, blue: 1, red: 1 }));
    expect(next.bank).toEqual(tokens({ white: 3, blue: 3, green: 4, red: 3, black: 4, gold: 5 }));
    expect(next.turn).toEqual({ number: 2, activePlayerId: other(state), step: 'ACTION' });
  });

  it('requires three colours while the bank has three', () => {
    const state = newGame();
    expectRejected(
      state,
      { type: 'TAKE_GEMS', colors: ['white', 'blue'] },
      SplendorRuleCodes.InvalidGemSelection,
    );
    expectRejected(
      state,
      { type: 'TAKE_GEMS', colors: ['white'] },
      SplendorRuleCodes.InvalidGemSelection,
    );
  });

  it('rejects a repeated colour among three', () => {
    expectRejected(
      newGame(),
      { type: 'TAKE_GEMS', colors: ['red', 'red', 'blue'] },
      SplendorRuleCodes.InvalidGemSelection,
    );
  });

  it('rejects a colour the bank has run out of', () => {
    const state = newGame({ bank: tokens({ white: 4, blue: 4, green: 4, black: 4, gold: 5 }) });
    expectRejected(
      state,
      { type: 'TAKE_GEMS', colors: ['red', 'white', 'blue'] },
      SplendorRuleCodes.GemsNotAvailable,
    );
  });

  it('takes fewer only when the bank has fewer than three colours left', () => {
    const state = newGame({ bank: tokens({ white: 1, blue: 2 }) });
    expect(getTakeCount(state.bank)).toBe(2);
    expectRejected(
      state,
      { type: 'TAKE_GEMS', colors: ['white'] },
      SplendorRuleCodes.InvalidGemSelection,
    );
    const next = apply(state, { type: 'TAKE_GEMS', colors: ['white', 'blue'] });
    expect(next.bank).toEqual(tokens({ blue: 1 }));
  });
});

describe('taking two gems of one colour', () => {
  it('is allowed from a pile of exactly four', () => {
    const state = newGame();
    const next = apply(state, { type: 'TAKE_GEMS', colors: ['green', 'green'] });
    expect(next.players[active(state)]?.tokens.green).toBe(2);
    expect(next.bank.green).toBe(2);
  });

  it('is refused from a pile of three', () => {
    const state = newGame({ bank: tokens({ white: 4, blue: 4, green: 3, red: 4, black: 4 }) });
    expectRejected(
      state,
      { type: 'TAKE_GEMS', colors: ['green', 'green'] },
      SplendorRuleCodes.DoubleNeedsFour,
    );
    expect(validateTakeGems(state.bank, ['white', 'white'])).toEqual({ valid: true });
  });
});

describe('the shape of TAKE_GEMS', () => {
  it.each([
    ['gold', { type: 'TAKE_GEMS', colors: ['gold', 'red', 'blue'] }],
    ['four colours', { type: 'TAKE_GEMS', colors: ['white', 'red', 'blue', 'green'] }],
    ['no colours', { type: 'TAKE_GEMS', colors: [] }],
    ['a non-list', { type: 'TAKE_GEMS', colors: 'red' }],
  ])('refuses %s', (_name, raw) => {
    expect(engine.parseAction(raw).ok).toBe(false);
  });

  it('copies only the colours', () => {
    const parsed = engine.parseAction({ type: 'TAKE_GEMS', colors: ['red', 'red'], cheat: 1 });
    expect(parsed).toEqual({ ok: true, action: { type: 'TAKE_GEMS', colors: ['red', 'red'] } });
  });
});

describe('the ten-token limit', () => {
  const overLimit = () => {
    const base = newGame();
    return withPlayer(base, active(base), {
      tokens: tokens({ white: 3, blue: 3, green: 3 }),
    });
  };

  it('stops the turn until the excess is returned', () => {
    const state = overLimit();
    const playerId = active(state);
    const taken = apply(state, { type: 'TAKE_GEMS', colors: ['white', 'blue', 'red'] });

    expect(taken.turn).toEqual({ number: 1, activePlayerId: playerId, step: 'RETURN_GEMS' });
    expect(engine.getPublicView(taken, { type: 'player', playerId }).legal.mustReturn).toBe(2);
    expectRejected(
      taken,
      { type: 'TAKE_GEMS', colors: ['white', 'blue', 'red'] },
      SplendorRuleCodes.WrongStep,
    );
  });

  it('accepts exactly the excess, of tokens the player holds', () => {
    const taken = apply(overLimit(), { type: 'TAKE_GEMS', colors: ['white', 'blue', 'red'] });
    const playerId = active(taken);

    expectRejected(
      taken,
      { type: 'RETURN_GEMS', tokens: { white: 1 } },
      SplendorRuleCodes.InvalidReturn,
    );
    expectRejected(
      taken,
      { type: 'RETURN_GEMS', tokens: { white: 3 } },
      SplendorRuleCodes.InvalidReturn,
    );
    expectRejected(
      taken,
      { type: 'RETURN_GEMS', tokens: { black: 2 } },
      SplendorRuleCodes.InvalidReturn,
    );

    const returned = apply(taken, { type: 'RETURN_GEMS', tokens: { white: 1, red: 1 } });
    expect(countTokens(returned.players[playerId]?.tokens ?? {})).toBe(10);
    expect(returned.bank.white).toBe(4);
    expect(returned.bank.red).toBe(4);
    expect(returned.turn.step).toBe('ACTION');
    expect(active(returned)).not.toBe(playerId);
  });

  it('refuses a return when nothing is owed', () => {
    expectRejected(newGame(), { type: 'RETURN_GEMS', tokens: {} }, SplendorRuleCodes.WrongStep);
  });

  it.each([
    ['a negative count', { type: 'RETURN_GEMS', tokens: { red: -1 } }],
    ['a fraction', { type: 'RETURN_GEMS', tokens: { red: 0.5 } }],
    ['no tokens', { type: 'RETURN_GEMS' }],
  ])('refuses the shape of %s', (_name, raw) => {
    expect(engine.parseAction(raw).ok).toBe(false);
  });
});
