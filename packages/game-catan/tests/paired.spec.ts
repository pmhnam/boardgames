import { describe, expect, it } from 'vitest';
import { CatanRuleCodes } from '../src/domain/errors.js';
import type { CatanState } from '../src/domain/state.js';
import {
  active,
  apply,
  build,
  cards,
  corner,
  engine,
  expectRejected,
  hold,
  holdCards,
  inMain,
  newGame,
  player,
  side,
} from './fixtures/states.js';

/** Corners far enough apart to all be built on, on either island. */
const SITES = [
  corner(2, -2, 0),
  corner(-2, 2, 0),
  corner(2, 0, 0),
  corner(-2, 0, 0),
  corner(0, 0, 0),
  corner(0, 2, 0),
];

function withBuildings(state: CatanState, playerId: string, cities: number, settlements: number) {
  let built = state;
  SITES.slice(0, cities + settlements).forEach((vertex, index) => {
    built = build(built, playerId, vertex, index < cities ? 'city' : 'settlement');
  });
  return built;
}

const viewOf = (state: CatanState, playerId: string) =>
  engine.getPublicView(state, { type: 'player', playerId });

describe.each([3, 4])('a table of %i', (players) => {
  it('has no paired turns: the dice go straight to the next player', () => {
    const state = inMain({ players });
    expect(viewOf(state, active(state)).turn.pairedPlayerId).toBeNull();

    const next = apply(state, { type: 'END_TURN' });
    expect(next.turn).toMatchObject({
      activePlayerId: state.turnOrder[1],
      step: 'ROLL',
      paired: false,
    });
  });
});

describe.each([5, 6])('paired turns at a table of %i', (players) => {
  const rolled = inMain({ players });
  const [roller, next, , partner] = rolled.turnOrder as [string, string, string, string];
  /** The first player has ended their turn: the third player to their left is on. */
  const paired = apply(rolled, { type: 'END_TURN' });

  it('follows a turn with one for the third player to the left, past the roll', () => {
    expect(paired.turn).toEqual({
      number: rolled.turn.number + 1,
      activePlayerId: partner,
      step: 'MAIN',
      paired: true,
      roll: null,
      developmentCardPlayed: false,
      freeRoads: 0,
      pendingDiscards: {},
      setupVertex: null,
      offer: null,
    });
    expect(engine.getCurrentPlayerIds(paired)).toEqual([partner]);
  });

  it('has no dice', () => {
    expectRejected(paired, { type: 'ROLL_DICE' }, CatanRuleCodes.WrongStep);
    expect(viewOf(paired, partner).legal.canRoll).toBe(false);
  });

  it('has no offers to the other players', () => {
    const state = hold(paired, partner, { brick: 2 });
    expectRejected(
      state,
      { type: 'PROPOSE_TRADE', give: { brick: 1 }, receive: { ore: 1 } },
      CatanRuleCodes.NoOffersOnPairedTurn,
    );
    expect(viewOf(state, partner).legal).toMatchObject({ canTrade: true, canOffer: false });
    // On a turn with dice the same player may offer.
    expect(viewOf(rolled, roller).legal).toMatchObject({ canTrade: true, canOffer: true });
  });

  it('trades with the supply', () => {
    const state = hold(paired, partner, { brick: 4 });
    const traded = apply(state, { type: 'SUPPLY_TRADE', give: 'brick', receive: 'ore' });
    expect(player(traded, partner).resources).toEqual(cards({ ore: 1 }));
    expect(traded.turn).toMatchObject({ activePlayerId: partner, step: 'MAIN', paired: true });
  });

  it('builds and buys', () => {
    const settled = build(paired, partner, corner(0, 0, 0));
    const state = hold(settled, partner, { brick: 1, wood: 1, wool: 1, wheat: 3, ore: 4 });

    const paved = apply(state, { type: 'BUILD_ROAD', edge: side(0, 0, 'NE') });
    expect(paved.roads[side(0, 0, 'NE')]).toBe(partner);

    const raised = apply(paved, { type: 'BUILD_CITY', vertex: corner(0, 0, 0) });
    expect(raised.buildings[corner(0, 0, 0)]).toEqual({ playerId: partner, kind: 'city' });

    const bought = apply(raised, { type: 'BUY_DEVELOPMENT_CARD' });
    expect(player(bought, partner).developmentCards).toHaveLength(1);
    // Bought on this turn, so it waits for another, as on any turn.
    expect(viewOf(bought, partner).legal.playableCards).toEqual([]);
  });

  it('plays one development card, and a knight comes back to the same turn', () => {
    const state = holdCards(paired, partner, ['knight', 'monopoly']);
    const played = apply(state, { type: 'PLAY_KNIGHT' });
    expect(played.turn).toMatchObject({ step: 'ROBBER', paired: true });

    const hex = Object.keys(played.tiles).find((key) => key !== played.robber) as string;
    const moved = apply(played, { type: 'MOVE_ROBBER', hex });
    expect(moved.turn).toMatchObject({ activePlayerId: partner, step: 'MAIN', paired: true });
    expectRejected(
      moved,
      { type: 'PLAY_MONOPOLY', resource: 'ore' },
      CatanRuleCodes.CardNotPlayable,
    );
  });

  it('keeps everyone else out, the player who rolled included', () => {
    expectRejected(paired, { type: 'END_TURN' }, CatanRuleCodes.NotYourTurn, roller);
    expectRejected(paired, { type: 'END_TURN' }, CatanRuleCodes.NotYourTurn, next);
  });

  it('passes the dice to the left of the player who rolled', () => {
    const after = apply(paired, { type: 'END_TURN' });
    expect(after.turn).toMatchObject({
      number: paired.turn.number + 1,
      activePlayerId: next,
      step: 'ROLL',
      paired: false,
    });
  });

  it('gives every player the dice once and a paired turn once in a round', () => {
    let state = rolled;
    const rollers: string[] = [];
    const partners: string[] = [];
    for (let turn = 0; turn < players; turn += 1) {
      rollers.push(active(state));
      state = apply(state, { type: 'END_TURN' });
      partners.push(active(state));
      state = apply(state, { type: 'END_TURN' });
      // The roll itself is not what is being counted here.
      state = { ...state, turn: { ...state.turn, step: 'MAIN' } };
    }
    expect(rollers).toEqual(rolled.turnOrder);
    expect(partners).toEqual([...rolled.turnOrder.slice(3), ...rolled.turnOrder.slice(0, 3)]);
    expect(active(state)).toBe(roller);
  });

  it('can be won on', () => {
    // Nine points, and the cards for the city that makes ten.
    const state = hold(withBuildings(paired, partner, 3, 3), partner, { wheat: 2, ore: 3 });
    expect(state.phase).toBe('PLAYING');

    const won = apply(state, { type: 'BUILD_CITY', vertex: SITES[5] as string });
    expect(won.phase).toBe('FINISHED');
    expect(won.winnerPlayerIds).toEqual([partner]);
  });

  it('is won as it starts by a player who already has the points', () => {
    // Ten points on somebody else's turn win nothing until a turn of one's own.
    const state = withBuildings(rolled, partner, 4, 2);
    expect(apply(state, { type: 'END_TURN' })).toMatchObject({
      phase: 'FINISHED',
      winnerPlayerIds: [partner],
    });
  });

  it('tells the table who is paired with the player who rolls', () => {
    expect(viewOf(rolled, next).turn).toMatchObject({ paired: false, pairedPlayerId: partner });
    expect(viewOf(paired, next).turn).toMatchObject({ paired: true, pairedPlayerId: null });
    // The opening is played one player at a time.
    const opening = newGame({}, { players });
    expect(viewOf(opening, next).turn).toMatchObject({ paired: false, pairedPlayerId: null });
  });
});
