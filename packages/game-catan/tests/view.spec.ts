import { describe, expect, it } from 'vitest';
import { deepFreeze } from '@bgp/game-core/testing';
import { NO_LEGAL_MOVES } from '../src/rules/legal-moves.js';
import {
  active,
  apply,
  build,
  cards,
  corner,
  engine,
  hold,
  holdCards,
  inMain,
  newGame,
  others,
  pave,
  player,
  rigDice,
  side,
  started,
} from './fixtures/states.js';

const viewOf = (state: Parameters<typeof engine.getPublicView>[0], playerId: string) =>
  engine.getPublicView(state, { type: 'player', playerId });

/** The active player and the next one both hold resource and development cards. */
function table() {
  const base = inMain({ seed: 'a-seed-nobody-should-see' });
  const me = active(base);
  const you = others(base)[0] as string;
  const state = holdCards(
    holdCards(hold(hold(base, me, { wood: 2, ore: 1 }), you, { wool: 3 }), me, ['knight']),
    you,
    ['victoryPoint', 'monopoly'],
  );
  return { state, me, you };
}

describe('what a player sees', () => {
  it('shows their own hand and cards in full', () => {
    const { state, me } = table();
    const mine = viewOf(state, me).players[me];
    expect(mine).toMatchObject({
      resourceCount: 3,
      resources: cards({ wood: 2, ore: 1 }),
      developmentCardCount: 1,
      developmentCards: [{ type: 'knight', fresh: false }],
    });
  });

  it('shows only the size of anyone else hand', () => {
    const { state, me, you } = table();
    const theirs = viewOf(state, me).players[you];
    expect(theirs).toMatchObject({
      resourceCount: 3,
      resources: null,
      developmentCardCount: 2,
      developmentCards: null,
      points: null,
    });
  });

  it('counts a hidden Victory Point card for its owner only', () => {
    const { state, me, you } = table();
    const built = build(state, you, corner(0, 0, 0));
    expect(viewOf(built, you).players[you]).toMatchObject({ publicPoints: 1, points: 2 });
    expect(viewOf(built, me).players[you]).toMatchObject({ publicPoints: 1, points: null });
  });

  it('marks a card bought this turn as not playable yet', () => {
    const base = inMain();
    const me = active(base);
    const state = holdCards(base, me, ['knight'], base.turn.number);
    expect(viewOf(state, me).players[me]?.developmentCards).toEqual([
      { type: 'knight', fresh: true },
    ]);
    expect(viewOf(state, me).legal.playableCards).toEqual([]);
  });

  it('looks the same to an opponent whatever the hidden cards are', () => {
    const { state, me, you } = table();
    // The same number of cards in the other player's hands, but different ones.
    const swapped = deepFreeze({
      ...state,
      players: {
        ...state.players,
        [you]: {
          ...player(state, you),
          resources: cards({ ore: 2, wheat: 1 }),
          developmentCards: [
            { type: 'knight' as const, boughtOnTurn: 0 },
            { type: 'knight' as const, boughtOnTurn: 0 },
          ],
        },
      },
      developmentDeck: [...state.developmentDeck].reverse(),
    });
    expect(viewOf(swapped, me)).toEqual(viewOf(state, me));
    expect(viewOf(swapped, you)).not.toEqual(viewOf(state, you));
  });

  it('never carries the seed, the deck or the draw count', () => {
    const { state, me } = table();
    for (const viewer of [
      { type: 'player', playerId: me },
      { type: 'spectator' },
      { type: 'admin' },
    ] as const) {
      const json = JSON.stringify(engine.getPublicView(state, viewer));
      expect(json).not.toContain('a-seed-nobody-should-see');
      expect(json).not.toContain('developmentDeck"');
      expect(json).not.toContain('draws');
      expect(json).not.toContain('"random"');
    }
  });

  it('shows a spectator and an admin no hand at all, and nothing to do', () => {
    const { state } = table();
    for (const viewer of [{ type: 'spectator' }, { type: 'admin' }] as const) {
      const view = engine.getPublicView(state, viewer);
      for (const seat of Object.values(view.players)) {
        expect(seat.resources).toBeNull();
        expect(seat.developmentCards).toBeNull();
        expect(seat.points).toBeNull();
      }
      expect(view.legal).toEqual(NO_LEGAL_MOVES);
    }
  });

  it('shows the board, the supply and the costs to everyone', () => {
    const state = newGame();
    const view = engine.getPublicView(state, { type: 'spectator' });
    expect(view.board.hexes).toHaveLength(19);
    expect(view.board.hexes[9]).toEqual({ q: 0, r: 0, terrain: 'desert', number: null });
    expect(view.board.ports).toHaveLength(9);
    expect(view.board.robber).toBe('0,0');
    expect(view.supply).toEqual(cards({ brick: 19, wood: 19, wool: 19, wheat: 19, ore: 19 }));
    expect(view.developmentDeckCount).toBe(25);
    expect(view.costs.city).toEqual(cards({ wheat: 2, ore: 3 }));
    expect(view).toMatchObject({
      victoryPointsToWin: 10,
      longestRouteMinimum: 5,
      largestArmyMinimum: 3,
      discardLimit: 7,
    });
  });

  it('shows what follows from the board: road length, pieces left and trade rates', () => {
    const base = inMain();
    const me = active(base);
    const state = pave(
      build(build(base, me, corner(0, -2, 0)), me, corner(0, 0, 0), 'city'),
      me,
      side(0, 0, 'NE'),
      side(0, 0, 'E'),
    );
    expect(viewOf(state, me).players[me]).toMatchObject({
      routeLength: 2,
      piecesLeft: { roads: 13, settlements: 4, cities: 3 },
      publicPoints: 3,
      supplyRates: { brick: 3, wood: 3, wool: 3, wheat: 3, ore: 3 },
    });
  });

  it('shows every hand once the game is over', () => {
    const { state, me, you } = table();
    const over = deepFreeze({ ...state, phase: 'FINISHED' as const, winnerPlayerIds: [me] });
    const view = engine.getPublicView(over, { type: 'spectator' });
    expect(view.players[you]).toMatchObject({ resources: cards({ wool: 3 }), points: 1 });
    expect(view.players[you]?.developmentCards).toHaveLength(2);
    expect(view.legal).toEqual(NO_LEGAL_MOVES);
  });
});

describe('what a player may do', () => {
  it('is to place, in the opening, for the active player only', () => {
    const state = newGame();
    expect(viewOf(state, active(state)).legal.settlementVertices).toHaveLength(54);
    expect(viewOf(state, others(state)[0] as string).legal).toEqual(NO_LEGAL_MOVES);

    const placed = apply(state, { type: 'PLACE_SETUP_SETTLEMENT', vertex: corner(0, 0, 0) });
    const legal = viewOf(placed, active(state)).legal;
    expect(legal.settlementVertices).toEqual([]);
    expect(legal.roadEdges.sort()).toEqual(
      [side(0, 0, 'NE'), side(0, 0, 'NW'), side(0, -1, 'E')].sort(),
    );
  });

  it('is to roll, or play a card, before the roll', () => {
    const base = started();
    const me = active(base);
    const legal = viewOf(holdCards(base, me, ['knight']), me).legal;
    expect(legal).toEqual({ ...NO_LEGAL_MOVES, canRoll: true, playableCards: ['knight'] });
  });

  it('lists what can be built with the cards in hand', () => {
    const base = inMain();
    const me = active(base);
    const settled = pave(build(base, me, corner(0, 0, 0)), me, side(0, 0, 'NE'), side(0, 0, 'E'));

    const broke = viewOf(settled, me).legal;
    expect(broke).toMatchObject({
      settlementVertices: [],
      roadEdges: [],
      cityVertices: [],
      canBuyDevelopmentCard: false,
      canTrade: true,
      canEndTurn: true,
    });

    const rich = viewOf(
      hold(settled, me, { brick: 1, wood: 1, wool: 1, wheat: 2, ore: 3 }),
      me,
    ).legal;
    expect(rich.settlementVertices).toEqual([corner(0, 0, 2)]);
    expect(rich.cityVertices).toEqual([corner(0, 0, 0)]);
    expect(rich.roadEdges).toContain(side(0, 0, 'SE'));
    expect(rich.roadEdges).not.toContain(side(0, 0, 'SW'));
    expect(rich.canBuyDevelopmentCard).toBe(true);
  });

  it('tells each player who owes cards to a 7 how many, whoever is on turn', () => {
    const base = started();
    const [second, third] = others(base) as [string, string];
    const state = apply(rigDice(hold(base, second, { wood: 9 }), 7), { type: 'ROLL_DICE' });

    expect(viewOf(state, second).legal).toEqual({ ...NO_LEGAL_MOVES, mustDiscard: 4 });
    expect(viewOf(state, third).legal).toEqual(NO_LEGAL_MOVES);
    expect(viewOf(state, active(base)).legal).toEqual(NO_LEGAL_MOVES);
    expect(viewOf(state, active(base)).turn.pendingDiscards).toEqual({ [second]: 4 });
  });

  it('tells the other players about an offer, and whether they can say yes', () => {
    const base = inMain();
    const me = active(base);
    const [second, third] = others(base) as [string, string];
    const state = apply(hold(hold(base, me, { wood: 1 }), second, { ore: 1 }), {
      type: 'PROPOSE_TRADE',
      give: { wood: 1 },
      receive: { ore: 1 },
    });

    expect(viewOf(state, second).legal).toEqual({
      ...NO_LEGAL_MOVES,
      canRespond: true,
      canAccept: true,
    });
    expect(viewOf(state, third).legal).toEqual({ ...NO_LEGAL_MOVES, canRespond: true });
    expect(viewOf(state, me).legal).toEqual({ ...NO_LEGAL_MOVES, canCancelTrade: true });

    const answered = apply(state, { type: 'RESPOND_TRADE', accept: true }, second);
    expect(viewOf(answered, second).legal).toEqual(NO_LEGAL_MOVES);
    expect(viewOf(answered, me).legal.accepters).toEqual([second]);
    expect(viewOf(answered, third).turn.offer?.responses).toEqual({ [second]: 'accepted' });
  });
});
