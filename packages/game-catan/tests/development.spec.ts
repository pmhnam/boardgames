import { describe, expect, it } from 'vitest';
import { deepFreeze } from '@bgp/game-core/testing';
import { DEFAULT_HEXES } from '../src/domain/default-board.js';
import { CatanRuleCodes } from '../src/domain/errors.js';
import type { CatanState } from '../src/domain/state.js';
import { buildTopology } from '../src/domain/topology.js';
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
  holdCards,
  inMain,
  others,
  pave,
  player,
  side,
  started,
  withTurn,
} from './fixtures/states.js';

const CARD_COST = { wool: 1, grain: 1, ore: 1 };

function withKnights(state: CatanState, playerId: string, knightsPlayed: number): CatanState {
  return deepFreeze({
    ...state,
    players: { ...state.players, [playerId]: { ...player(state, playerId), knightsPlayed } },
  });
}

describe('buying a development card', () => {
  it('costs a wool, a grain and an ore and takes the top card of the deck', () => {
    const base = inMain();
    const me = active(base);
    const state = hold(base, me, { ...CARD_COST, brick: 1 });
    const top = state.developmentDeck.at(-1);

    const next = apply(state, { type: 'BUY_DEVELOPMENT_CARD' });

    expect(player(next, me).developmentCards).toEqual([
      { type: top, boughtOnTurn: state.turn.number },
    ]);
    expect(next.developmentDeck).toEqual(state.developmentDeck.slice(0, -1));
    expect(player(next, me).resources).toEqual(cards({ brick: 1 }));
    expect(countAll(next)).toEqual(countAll(state));
  });

  it('is refused without the cards, before the roll, or when the deck is empty', () => {
    const base = inMain();
    const me = active(base);
    expectRejected(
      hold(base, me, { wool: 1, grain: 1 }),
      { type: 'BUY_DEVELOPMENT_CARD' },
      CatanRuleCodes.CannotAfford,
    );
    expectRejected(
      hold(started(), me, CARD_COST),
      { type: 'BUY_DEVELOPMENT_CARD' },
      CatanRuleCodes.WrongStep,
    );
    expectRejected(
      deepFreeze({ ...hold(base, me, CARD_COST), developmentDeck: [] }),
      { type: 'BUY_DEVELOPMENT_CARD' },
      CatanRuleCodes.DeckEmpty,
    );
  });
});

describe('playing a development card', () => {
  it('is refused on the turn the card was bought', () => {
    const base = inMain();
    const state = holdCards(base, active(base), ['knight'], base.turn.number);
    expectRejected(state, { type: 'PLAY_KNIGHT' }, CatanRuleCodes.CardNotPlayable);
  });

  it('is refused for a card the player does not hold', () => {
    const base = inMain();
    const state = holdCards(base, active(base), ['knight']);
    expectRejected(
      state,
      { type: 'PLAY_MONOPOLY', resource: 'ore' },
      CatanRuleCodes.CardNotPlayable,
    );
    expectRejected(
      holdCards(base, others(base)[0] as string, ['knight']),
      { type: 'PLAY_KNIGHT' },
      CatanRuleCodes.CardNotPlayable,
    );
  });

  it('is allowed once a turn', () => {
    const base = inMain();
    const state = holdCards(base, active(base), ['monopoly', 'knight']);
    const next = apply(state, { type: 'PLAY_MONOPOLY', resource: 'ore' });
    expect(next.turn.developmentCardPlayed).toBe(true);
    expectRejected(next, { type: 'PLAY_KNIGHT' }, CatanRuleCodes.CardNotPlayable);
  });

  it('is allowed again on the next turn', () => {
    const base = inMain();
    const state = holdCards(base, active(base), ['monopoly']);
    const next = apply(apply(state, { type: 'PLAY_MONOPOLY', resource: 'ore' }), {
      type: 'END_TURN',
    });
    expect(next.turn.developmentCardPlayed).toBe(false);
  });

  it('is refused from a player who is not on turn', () => {
    const base = inMain();
    const waiting = others(base)[0] as string;
    expectRejected(
      holdCards(base, waiting, ['knight']),
      { type: 'PLAY_KNIGHT' },
      CatanRuleCodes.NotYourTurn,
      waiting,
    );
  });

  it('keeps a Victory Point card in the hand: there is nothing to play', () => {
    const base = inMain();
    const state = holdCards(base, active(base), ['victoryPoint']);
    const view = engine.getPublicView(state, { type: 'player', playerId: active(base) });
    expect(view.legal.playableCards).toEqual([]);
    expect(engine.parseAction({ type: 'PLAY_VICTORY_POINT' }).ok).toBe(false);
  });
});

describe('a knight', () => {
  it('sends the robber off and joins the player army', () => {
    const base = inMain();
    const me = active(base);
    const state = holdCards(base, me, ['knight']);

    const next = apply(state, { type: 'PLAY_KNIGHT' });

    expect(next.turn.step).toBe('ROBBER');
    expect(player(next, me)).toMatchObject({ knightsPlayed: 1, developmentCards: [] });
    expect(apply(next, { type: 'MOVE_ROBBER', hex: '1,0' }).turn.step).toBe('MAIN');
  });

  it('may be played before the roll, which then still comes', () => {
    const base = started();
    const state = holdCards(base, active(base), ['knight']);

    const robbing = apply(state, { type: 'PLAY_KNIGHT' });
    expectRejected(robbing, { type: 'ROLL_DICE' }, CatanRuleCodes.WrongStep);
    const moved = apply(robbing, { type: 'MOVE_ROBBER', hex: '1,0' });

    expect(moved.turn).toMatchObject({ step: 'ROLL', roll: null, developmentCardPlayed: true });
    expect(apply(moved, { type: 'ROLL_DICE' }).turn.roll).not.toBeNull();
  });

  it('asks nobody to discard', () => {
    const base = inMain();
    const rich = others(base)[0] as string;
    const state = hold(holdCards(base, active(base), ['knight']), rich, { wood: 12 });
    const next = apply(state, { type: 'PLAY_KNIGHT' });
    expect(next.turn).toMatchObject({ step: 'ROBBER', pendingDiscards: {} });
  });

  it('wins Largest Army with the third', () => {
    const base = inMain();
    const me = active(base);
    const two = withKnights(holdCards(base, me, ['knight']), me, 1);
    expect(apply(two, { type: 'PLAY_KNIGHT' }).largestArmyPlayerId).toBeNull();

    const three = withKnights(holdCards(base, me, ['knight']), me, 2);
    expect(apply(three, { type: 'PLAY_KNIGHT' }).largestArmyPlayerId).toBe(me);
  });

  it('takes Largest Army only with more knights than its holder', () => {
    const base = inMain();
    const me = active(base);
    const holder = others(base)[0] as string;
    const held = deepFreeze({
      ...withKnights(holdCards(base, me, ['knight']), holder, 4),
      largestArmyPlayerId: holder,
    });

    expect(apply(withKnights(held, me, 3), { type: 'PLAY_KNIGHT' }).largestArmyPlayerId).toBe(
      holder,
    );
    expect(apply(withKnights(held, me, 4), { type: 'PLAY_KNIGHT' }).largestArmyPlayerId).toBe(me);
  });
});

describe('Road Building', () => {
  /** A settlement to build from, and no cards at all. */
  const ready = (base: CatanState) =>
    holdCards(build(base, active(base), corner(0, 0, 0)), active(base), ['roadBuilding']);

  it('places two roads for nothing', () => {
    const state = ready(inMain());
    const me = active(state);

    const played = apply(state, { type: 'PLAY_ROAD_BUILDING' });
    expect(played.turn.freeRoads).toBe(2);
    const one = apply(played, { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') });
    expect(one.turn.freeRoads).toBe(1);
    const two = apply(one, { type: 'BUILD_ROAD', edge: side(0, 0, 'E') });

    expect(two.turn.freeRoads).toBe(0);
    expect(Object.keys(two.roads)).toHaveLength(2);
    expect(player(two, me).resources).toEqual(cards());
    expect(two.supply).toEqual(state.supply);
    expectRejected(
      two,
      { type: 'BUILD_ROAD', edge: side(0, 0, 'SE') },
      CatanRuleCodes.CannotAfford,
    );
  });

  it('holds everything else up until the roads are placed', () => {
    const state = apply(ready(inMain()), { type: 'PLAY_ROAD_BUILDING' });
    expectRejected(state, { type: 'END_TURN' }, CatanRuleCodes.RoadsPending);
    expectRejected(state, { type: 'BUY_DEVELOPMENT_CARD' }, CatanRuleCodes.RoadsPending);
    expectRejected(
      state,
      { type: 'PROPOSE_TRADE', give: { ore: 1 }, receive: { wool: 1 } },
      CatanRuleCodes.RoadsPending,
    );
  });

  it('may be played before the roll, the roads placed before it too', () => {
    const state = apply(ready(started()), { type: 'PLAY_ROAD_BUILDING' });
    expectRejected(state, { type: 'ROLL_DICE' }, CatanRuleCodes.RoadsPending);

    const placed = apply(apply(state, { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') }), {
      type: 'BUILD_ROAD',
      edge: side(0, 0, 'E'),
    });
    expect(placed.turn).toMatchObject({ step: 'ROLL', freeRoads: 0 });
    expect(apply(placed, { type: 'ROLL_DICE' }).turn.roll).not.toBeNull();
  });

  it('places one road when that is all the player has left', () => {
    const base = ready(inMain());
    const me = active(base);
    const edges = buildTopology(DEFAULT_HEXES).edges.filter(
      (edge) => edge !== side(0, 0, 'NE') && edge !== side(0, 0, 'NW'),
    );
    const state = pave(base, me, ...edges.slice(0, 14));

    const played = apply(state, { type: 'PLAY_ROAD_BUILDING' });
    expect(played.turn.freeRoads).toBe(1);
    expect(apply(played, { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') }).turn.freeRoads).toBe(0);
  });

  it('is refused with nowhere to build or nothing to build with', () => {
    const base = inMain();
    const me = active(base);
    expectRejected(
      holdCards(base, me, ['roadBuilding']),
      { type: 'PLAY_ROAD_BUILDING' },
      CatanRuleCodes.CardNotPlayable,
    );
    const paved = pave(ready(base), me, ...buildTopology(DEFAULT_HEXES).edges.slice(0, 15));
    expectRejected(paved, { type: 'PLAY_ROAD_BUILDING' }, CatanRuleCodes.CardNotPlayable);
  });
});

describe('Year of Plenty', () => {
  it('takes any two cards from the supply', () => {
    const base = inMain();
    const me = active(base);
    const state = holdCards(base, me, ['yearOfPlenty', 'yearOfPlenty']);

    const mixed = apply(state, { type: 'PLAY_YEAR_OF_PLENTY', resources: ['ore', 'wool'] });
    expect(player(mixed, me).resources).toEqual(cards({ ore: 1, wool: 1 }));
    expect(mixed.supply).toMatchObject({ ore: 18, wool: 18 });

    const same = apply(state, { type: 'PLAY_YEAR_OF_PLENTY', resources: ['ore', 'ore'] });
    expect(player(same, me).resources).toEqual(cards({ ore: 2 }));
    expect(player(same, me).developmentCards).toHaveLength(1);
  });

  it('is refused for cards the supply does not have', () => {
    const base = inMain();
    const state = deepFreeze({
      ...holdCards(base, active(base), ['yearOfPlenty']),
      supply: { ...base.supply, ore: 1, wool: 0 },
    });
    expectRejected(
      state,
      { type: 'PLAY_YEAR_OF_PLENTY', resources: ['ore', 'ore'] },
      CatanRuleCodes.SupplyShort,
    );
    expectRejected(
      state,
      { type: 'PLAY_YEAR_OF_PLENTY', resources: ['wool', 'grain'] },
      CatanRuleCodes.SupplyShort,
    );
  });

  it('must name exactly two resources', () => {
    expect(engine.parseAction({ type: 'PLAY_YEAR_OF_PLENTY', resources: ['ore'] }).ok).toBe(false);
    expect(engine.parseAction({ type: 'PLAY_YEAR_OF_PLENTY', resources: ['ore', 'gold'] }).ok).toBe(
      false,
    );
  });
});

describe('Monopoly', () => {
  it('collects every card of one resource from the other players', () => {
    const base = inMain();
    const me = active(base);
    const [second, third] = others(base) as [string, string];
    const state = hold(
      hold(hold(holdCards(base, me, ['monopoly']), me, { ore: 1 }), second, { ore: 3, wool: 2 }),
      third,
      { ore: 2 },
    );

    const next = apply(state, { type: 'PLAY_MONOPOLY', resource: 'ore' });

    expect(player(next, me).resources).toEqual(cards({ ore: 6 }));
    expect(player(next, second).resources).toEqual(cards({ wool: 2 }));
    expect(player(next, third).resources).toEqual(cards());
    expect(next.supply).toEqual(state.supply);
  });

  it('may collect nothing', () => {
    const base = inMain();
    const state = holdCards(base, active(base), ['monopoly']);
    const next = apply(state, { type: 'PLAY_MONOPOLY', resource: 'brick' });
    expect(player(next, active(base)).resources).toEqual(cards());
    expect(withTurn(next, {}).turn.developmentCardPlayed).toBe(true);
  });
});
