import { describe, expect, it } from 'vitest';
import { CatanRuleCodes } from '../src/domain/errors.js';
import { getSupplyRates } from '../src/rules/trade.rules.js';
import {
  active,
  apply,
  build,
  cards,
  corner,
  countAll,
  engine,
  expectRejected,
  hold,
  inMain,
  others,
  player,
  started,
} from './fixtures/states.js';

describe('trading with the supply', () => {
  it('gives one card for four of a kind', () => {
    const base = inMain();
    const me = active(base);
    const state = hold(base, me, { wood: 5 });

    const next = apply(state, { type: 'SUPPLY_TRADE', give: 'wood', receive: 'ore' });

    expect(player(next, me).resources).toEqual(cards({ wood: 1, ore: 1 }));
    expect(next.supply).toMatchObject({ wood: 18, ore: 18 });
    expect(countAll(next)).toEqual(countAll(state));
  });

  it('costs three of anything from a generic harbor', () => {
    const base = inMain();
    const me = active(base);
    // The default board has a generic harbor on the upper-left side of the top-left hex.
    const state = hold(build(base, me, corner(0, -2, 0)), me, { wool: 3 });

    expect(getSupplyRates(state, me)).toEqual({ brick: 3, wood: 3, wool: 3, grain: 3, ore: 3 });
    const next = apply(state, { type: 'SUPPLY_TRADE', give: 'wool', receive: 'brick' });
    expect(player(next, me).resources).toEqual(cards({ brick: 1 }));
  });

  it('costs two of its own resource from a resource harbor, and four of the others', () => {
    const base = inMain();
    const me = active(base);
    // The grain harbor is on the upper-right side of the top-middle hex.
    const state = hold(build(base, me, corner(1, -2, 1), 'city'), me, { grain: 2, wool: 3 });

    expect(getSupplyRates(state, me)).toEqual({ brick: 4, wood: 4, wool: 4, grain: 2, ore: 4 });
    const next = apply(state, { type: 'SUPPLY_TRADE', give: 'grain', receive: 'ore' });
    expect(player(next, me).resources).toEqual(cards({ wool: 3, ore: 1 }));
    expectRejected(
      state,
      { type: 'SUPPLY_TRADE', give: 'wool', receive: 'ore' },
      CatanRuleCodes.CannotAfford,
    );
  });

  it('takes the better of two harbors, and nothing from somebody else harbor', () => {
    const base = inMain();
    const me = active(base);
    const you = others(base)[0] as string;
    const state = build(build(base, me, corner(0, -2, 0)), me, corner(1, -2, 1));
    expect(getSupplyRates(state, me)).toEqual({ brick: 3, wood: 3, wool: 3, grain: 2, ore: 3 });
    expect(getSupplyRates(state, you)).toEqual({ brick: 4, wood: 4, wool: 4, grain: 4, ore: 4 });
  });

  it('is refused without enough cards, for the same resource, or for one the supply lacks', () => {
    const base = inMain();
    const me = active(base);
    const state = hold(base, me, { wood: 4, brick: 3 });

    expectRejected(
      state,
      { type: 'SUPPLY_TRADE', give: 'brick', receive: 'ore' },
      CatanRuleCodes.CannotAfford,
    );
    expectRejected(
      state,
      { type: 'SUPPLY_TRADE', give: 'wood', receive: 'wood' },
      CatanRuleCodes.InvalidTrade,
    );
    expectRejected(
      { ...state, supply: { ...state.supply, ore: 0 } },
      { type: 'SUPPLY_TRADE', give: 'wood', receive: 'ore' },
      CatanRuleCodes.SupplyShort,
    );
  });

  it('is refused before the roll', () => {
    const base = started();
    expectRejected(
      hold(base, active(base), { wood: 4 }),
      { type: 'SUPPLY_TRADE', give: 'wood', receive: 'ore' },
      CatanRuleCodes.WrongStep,
    );
  });
});

describe('trading with the other players', () => {
  /** The active player holds wood, the second player ore, the third nothing. */
  const table = () => {
    const base = inMain();
    const me = active(base);
    const [second, third] = others(base) as [string, string];
    const state = hold(hold(base, me, { wood: 2, brick: 1 }), second, { ore: 2 });
    return { state, me, second, third };
  };
  const OFFER = { type: 'PROPOSE_TRADE', give: { wood: 2 }, receive: { ore: 1 } } as const;

  it('opens an offer the others are asked to answer', () => {
    const { state, me, second, third } = table();
    const next = apply(state, OFFER);

    expect(next.turn.offer).toEqual({
      give: cards({ wood: 2 }),
      receive: cards({ ore: 1 }),
      responses: {},
    });
    expect(engine.getCurrentPlayerIds(next)).toEqual([second, third, me]);
    expect(player(next, me).resources).toEqual(cards({ wood: 2, brick: 1 }));
  });

  it('refuses an offer that gives nothing, asks nothing, or trades a resource for itself', () => {
    const { state } = table();
    expectRejected(
      state,
      { type: 'PROPOSE_TRADE', give: {}, receive: { ore: 1 } },
      CatanRuleCodes.InvalidTrade,
    );
    expectRejected(
      state,
      { type: 'PROPOSE_TRADE', give: { wood: 1 }, receive: {} },
      CatanRuleCodes.InvalidTrade,
    );
    expectRejected(
      state,
      { type: 'PROPOSE_TRADE', give: { wood: 2 }, receive: { wood: 1, ore: 1 } },
      CatanRuleCodes.InvalidTrade,
    );
  });

  it('refuses an offer of cards the player does not hold, or made before the roll', () => {
    const { state } = table();
    expectRejected(
      state,
      { type: 'PROPOSE_TRADE', give: { wood: 3 }, receive: { ore: 1 } },
      CatanRuleCodes.CannotAfford,
    );
    const base = started();
    expectRejected(hold(base, active(base), { wood: 2 }), OFFER, CatanRuleCodes.WrongStep);
  });

  it('refuses an offer from a player who is not on turn', () => {
    const { state, second } = table();
    expectRejected(
      state,
      { type: 'PROPOSE_TRADE', give: { ore: 1 }, receive: { wood: 1 } },
      CatanRuleCodes.NotYourTurn,
      second,
    );
  });

  it('lets the others accept or decline, out of turn and in any order', () => {
    const { state, me, second, third } = table();
    const offered = apply(state, OFFER);

    const declined = apply(offered, { type: 'RESPOND_TRADE', accept: false }, third);
    expect(declined.turn.offer?.responses).toEqual({ [third]: 'declined' });
    expect(engine.getCurrentPlayerIds(declined)).toEqual([second, me]);

    const accepted = apply(declined, { type: 'RESPOND_TRADE', accept: true }, second);
    expect(accepted.turn.offer?.responses).toEqual({ [third]: 'declined', [second]: 'accepted' });
    expect(engine.getCurrentPlayerIds(accepted)).toEqual([me]);
  });

  it('refuses a yes from a player without the cards, but takes their no', () => {
    const { state, third } = table();
    const offered = apply(state, OFFER);
    expectRejected(
      offered,
      { type: 'RESPOND_TRADE', accept: true },
      CatanRuleCodes.CannotAfford,
      third,
    );
    expect(
      apply(offered, { type: 'RESPOND_TRADE', accept: false }, third).turn.offer,
    ).not.toBeNull();
  });

  it('refuses a second answer, an answer to nothing, and an answer to one own offer', () => {
    const { state, me, second } = table();
    const offered = apply(state, OFFER);
    const answered = apply(offered, { type: 'RESPOND_TRADE', accept: true }, second);

    expectRejected(
      answered,
      { type: 'RESPOND_TRADE', accept: false },
      CatanRuleCodes.AlreadyResponded,
      second,
    );
    expectRejected(state, { type: 'RESPOND_TRADE', accept: false }, CatanRuleCodes.NoOffer, second);
    expectRejected(
      offered,
      { type: 'RESPOND_TRADE', accept: true },
      CatanRuleCodes.InvalidTrade,
      me,
    );
  });

  it('swaps the cards with the player the proposer picks', () => {
    const { state, me, second } = table();
    const accepted = apply(apply(state, OFFER), { type: 'RESPOND_TRADE', accept: true }, second);

    const next = apply(accepted, { type: 'CONFIRM_TRADE', playerId: second });

    expect(player(next, me).resources).toEqual(cards({ brick: 1, ore: 1 }));
    expect(player(next, second).resources).toEqual(cards({ wood: 2, ore: 1 }));
    expect(next.turn.offer).toBeNull();
    expect(next.supply).toEqual(state.supply);
    expect(engine.getCurrentPlayerIds(next)).toEqual([me]);
  });

  it('only closes with a player who accepted', () => {
    const { state, second, third } = table();
    const offered = apply(state, OFFER);
    expectRejected(
      offered,
      { type: 'CONFIRM_TRADE', playerId: second },
      CatanRuleCodes.OfferNotAccepted,
    );
    const declined = apply(offered, { type: 'RESPOND_TRADE', accept: false }, third);
    expectRejected(
      declined,
      { type: 'CONFIRM_TRADE', playerId: third },
      CatanRuleCodes.OfferNotAccepted,
    );
    expectRejected(state, { type: 'CONFIRM_TRADE', playerId: second }, CatanRuleCodes.NoOffer);
    expectRejected(
      offered,
      { type: 'CONFIRM_TRADE', playerId: second },
      CatanRuleCodes.NotYourTurn,
      second,
    );
  });

  it('can be withdrawn at any time, answered or not', () => {
    const { state, second } = table();
    const offered = apply(state, OFFER);
    expect(apply(offered, { type: 'CANCEL_TRADE' }).turn.offer).toBeNull();

    const accepted = apply(offered, { type: 'RESPOND_TRADE', accept: true }, second);
    const withdrawn = apply(accepted, { type: 'CANCEL_TRADE' });
    expect(withdrawn.turn.offer).toBeNull();
    expect(withdrawn.players).toEqual(state.players);
    expectRejected(state, { type: 'CANCEL_TRADE' }, CatanRuleCodes.NoOffer);
  });

  it('holds the rest of the turn up while it is open', () => {
    const { state } = table();
    const offered = apply(state, OFFER);
    expectRejected(offered, { type: 'END_TURN' }, CatanRuleCodes.OfferPending);
    expectRejected(offered, OFFER, CatanRuleCodes.OfferPending);
    expectRejected(offered, { type: 'BUILD_ROAD', edge: 'anywhere' }, CatanRuleCodes.OfferPending);
    expectRejected(
      offered,
      { type: 'SUPPLY_TRADE', give: 'wood', receive: 'ore' },
      CatanRuleCodes.OfferPending,
    );
  });
});
