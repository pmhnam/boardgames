import { describe, expect, it } from 'vitest';
import { deepFreeze, runMatch, seats } from '@bgp/game-core/testing';
import type { CatanAction } from '../src/domain/actions.js';
import { DEFAULT_HEXES } from '../src/domain/default-board.js';
import { CatanRuleCodes } from '../src/domain/errors.js';
import { RESOURCES, type Resource } from '../src/domain/resources.js';
import type { CatanState } from '../src/domain/state.js';
import { buildTopology, neighboursOf } from '../src/domain/topology.js';
import { getPiecesLeft } from '../src/rules/placement.rules.js';
import { getPoints } from '../src/scoring/score.js';
import { listOptions, scriptFullGame } from './fixtures/script.js';
import {
  active,
  apply,
  build,
  context,
  corner,
  countAll,
  engine,
  expectRejected,
  hold,
  holdCards,
  inMain,
  others,
  started,
  validate,
} from './fixtures/states.js';

const topology = buildTopology(DEFAULT_HEXES);

/** Corners far enough apart to all be built on. */
const SITES = [
  corner(2, -2, 0),
  corner(-2, 2, 0),
  corner(2, 0, 0),
  corner(-2, 0, 0),
  corner(0, 0, 0),
];

function withBuildings(state: CatanState, playerId: string, cities: number, settlements: number) {
  let built = state;
  SITES.slice(0, cities + settlements).forEach((vertex, index) => {
    built = build(built, playerId, vertex, index < cities ? 'city' : 'settlement');
  });
  return built;
}

describe('a turn', () => {
  it('passes to the next player, who starts by rolling', () => {
    const state = inMain();
    const next = apply(state, { type: 'END_TURN' });
    expect(next.turn).toEqual({
      number: state.turn.number + 1,
      activePlayerId: others(state)[0],
      step: 'ROLL',
      roll: null,
      developmentCardPlayed: false,
      freeRoads: 0,
      pendingDiscards: {},
      setupVertex: null,
      offer: null,
    });
  });

  it('comes back round to the first player', () => {
    let state = inMain();
    const first = active(state);
    for (let turn = 0; turn < state.turnOrder.length; turn += 1) {
      if (state.turn.step === 'ROLL') state = { ...state, turn: { ...state.turn, step: 'MAIN' } };
      state = apply(state, { type: 'END_TURN' });
    }
    expect(active(state)).toBe(first);
  });

  it('cannot end before the roll', () => {
    expectRejected(started(), { type: 'END_TURN' }, CatanRuleCodes.WrongStep);
  });
});

describe('winning', () => {
  it('happens the moment the active player has ten points', () => {
    const base = inMain();
    const me = active(base);
    // Three cities and three settlements are nine points; a fourth city makes ten.
    const state = hold(withBuildings(base, me, 3, 2), me, { grain: 2, ore: 3 });
    const last = corner(0, -2, 0);
    const ready = build(state, me, last);
    expect(getPoints(ready, me)).toBe(9);
    expect(engine.getResult(ready)).toBeNull();

    const next = apply(ready, { type: 'BUILD_CITY', vertex: last });

    expect(next.phase).toBe('FINISHED');
    expect(next.winnerPlayerIds).toEqual([me]);
    expect(engine.getGameStatus(next)).toBe('finished');
    expect(engine.getCurrentPlayerIds(next)).toEqual([]);
    expect(engine.getResult(next)).toEqual({
      winnerPlayerIds: [me],
      scores: Object.fromEntries(next.turnOrder.map((id) => [id, id === me ? 10 : 0])),
    });
  });

  it('counts Victory Point cards nobody else can see', () => {
    const base = inMain();
    const me = active(base);
    const state = hold(
      holdCards(withBuildings(base, me, 2, 3), me, ['victoryPoint', 'victoryPoint']),
      me,
      { grain: 2, ore: 3 },
    );
    expect(getPoints(state, me)).toBe(9);

    const next = apply(state, { type: 'BUILD_CITY', vertex: SITES[2] as string });
    expect(next.phase).toBe('FINISHED');
    expect(engine.getResult(next)?.scores?.[me]).toBe(10);
  });

  it('can come from a Victory Point card just bought', () => {
    const base = inMain();
    const me = active(base);
    const state = deepFreeze({
      ...hold(withBuildings(base, me, 4, 1), me, { wool: 1, grain: 1, ore: 1 }),
      developmentDeck: ['victoryPoint' as const],
    });
    const next = apply(state, { type: 'BUY_DEVELOPMENT_CARD' });
    expect(next.winnerPlayerIds).toEqual([me]);
  });

  it('counts Longest Road and Largest Army', () => {
    const base = inMain();
    const me = active(base);
    const state = deepFreeze({
      ...withBuildings(base, me, 2, 2),
      longestRoadPlayerId: me,
      largestArmyPlayerId: me,
    });
    expect(getPoints(state, me)).toBe(10);
  });

  it('waits for the player own turn', () => {
    const base = inMain();
    const me = active(base);
    const next = others(base)[0] as string;
    // The next player already has ten points, say from a road somebody else just cut.
    const state = hold(withBuildings(base, next, 4, 1), me, { wood: 4 });
    const waiting = deepFreeze({ ...state, longestRoadPlayerId: next });
    expect(getPoints(waiting, next)).toBe(11);

    const traded = apply(waiting, { type: 'SUPPLY_TRADE', give: 'wood', receive: 'ore' });
    expect(traded.phase).toBe('PLAYING');

    const passed = apply(traded, { type: 'END_TURN' });
    expect(passed.phase).toBe('FINISHED');
    expect(passed.winnerPlayerIds).toEqual([next]);
  });

  it('ends everything: nobody may act afterwards', () => {
    const state = deepFreeze({ ...inMain(), phase: 'FINISHED' as const });
    expectRejected(state, { type: 'END_TURN' }, CatanRuleCodes.GameNotPlaying);
    expectRejected(
      state,
      { type: 'RESPOND_TRADE', accept: false },
      CatanRuleCodes.GameNotPlaying,
      others(state)[0],
    );
  });
});

describe('untrusted actions', () => {
  it('are refused unless they have a known shape', () => {
    for (const raw of [
      null,
      'ROLL_DICE',
      {},
      { type: 'CHEAT' },
      { type: 'BUILD_ROAD' },
      { type: 'BUILD_ROAD', edge: 7 },
      { type: 'BUILD_CITY', vertex: 'x'.repeat(100) },
      { type: 'DISCARD', resources: { wood: -1 } },
      { type: 'DISCARD', resources: { wood: 1.5 } },
      { type: 'MOVE_ROBBER', hex: '1,0', victimId: 3 },
      { type: 'SUPPLY_TRADE', give: 'wood', receive: 'gold' },
      { type: 'PROPOSE_TRADE', give: { wood: 1 } },
      { type: 'RESPOND_TRADE', accept: 'yes' },
      { type: 'CONFIRM_TRADE' },
    ]) {
      expect(engine.parseAction(raw).ok).toBe(false);
    }
  });

  it('keep only the fields the engine knows', () => {
    expect(engine.parseAction({ type: 'ROLL_DICE', roll: [6, 6], extra: true })).toEqual({
      ok: true,
      action: { type: 'ROLL_DICE' },
    });
    expect(
      engine.parseAction({ type: 'DISCARD', resources: { wood: 2, ore: 0, gold: 5 } }),
    ).toEqual({ ok: true, action: { type: 'DISCARD', resources: { wood: 2 } } });
    expect(engine.parseAction({ type: 'MOVE_ROBBER', hex: '1,0', victimId: null })).toEqual({
      ok: true,
      action: { type: 'MOVE_ROBBER', hex: '1,0' },
    });
  });
});

/** What must hold after every action of every game. */
function expectSound(state: CatanState): void {
  expect(countAll(state)).toEqual({ brick: 19, wood: 19, wool: 19, grain: 19, ore: 19 });
  for (const resource of RESOURCES) expect(state.supply[resource]).toBeGreaterThanOrEqual(0);

  let cardsOut = state.developmentDeck.length;
  for (const playerId of state.turnOrder) {
    const held = state.players[playerId];
    if (!held) throw new Error('Missing player');
    for (const resource of RESOURCES) expect(held.resources[resource]).toBeGreaterThanOrEqual(0);
    cardsOut += held.developmentCards.length + held.knightsPlayed;
    const left = getPiecesLeft(state, playerId);
    expect(Math.min(left.roads, left.settlements, left.cities)).toBeGreaterThanOrEqual(0);
  }
  expect(cardsOut).toBeLessThanOrEqual(25);

  for (const vertex of Object.keys(state.buildings)) {
    expect(
      neighboursOf(topology, vertex).filter((neighbour) => state.buildings[neighbour]),
    ).toEqual([]);
  }
  if (state.phase === 'PLAYING') {
    expect(engine.getCurrentPlayerIds(state).length).toBeGreaterThan(0);
    expect(state.winnerPlayerIds).toEqual([]);
  }
}

const sortedKeys = (action: CatanAction) => JSON.stringify(action, Object.keys(action).sort());

/** Every action anyone could try, short of discards and offers, which have no end. */
function universe(state: CatanState): CatanAction[] {
  const pairs = RESOURCES.flatMap((first, index) =>
    RESOURCES.slice(index).map((second): Resource[] => [first, second]),
  );
  return [
    ...topology.vertices.flatMap((vertex): CatanAction[] => [
      { type: 'PLACE_SETUP_SETTLEMENT', vertex },
      { type: 'BUILD_SETTLEMENT', vertex },
      { type: 'BUILD_CITY', vertex },
    ]),
    ...topology.edges.flatMap((edge): CatanAction[] => [
      { type: 'PLACE_SETUP_ROAD', edge },
      { type: 'BUILD_ROAD', edge },
    ]),
    ...topology.hexes.flatMap((hex): CatanAction[] => [
      { type: 'MOVE_ROBBER', hex },
      ...state.turnOrder.map((victimId): CatanAction => ({ type: 'MOVE_ROBBER', hex, victimId })),
    ]),
    { type: 'ROLL_DICE' },
    { type: 'BUY_DEVELOPMENT_CARD' },
    { type: 'PLAY_KNIGHT' },
    { type: 'PLAY_ROAD_BUILDING' },
    ...pairs.map((resources): CatanAction => ({ type: 'PLAY_YEAR_OF_PLENTY', resources })),
    ...RESOURCES.map((resource): CatanAction => ({ type: 'PLAY_MONOPOLY', resource })),
    ...RESOURCES.flatMap((give) =>
      RESOURCES.map((receive): CatanAction => ({ type: 'SUPPLY_TRADE', give, receive })),
    ),
    { type: 'RESPOND_TRADE', accept: true },
    { type: 'RESPOND_TRADE', accept: false },
    ...state.turnOrder.map((playerId): CatanAction => ({ type: 'CONFIRM_TRADE', playerId })),
    { type: 'CANCEL_TRADE' },
    { type: 'END_TURN' },
  ];
}

/** The validator must accept exactly what each seat's view says it may do. */
function expectLegalMatchesValidator(state: CatanState): void {
  const everything = universe(state);
  for (const playerId of state.turnOrder) {
    const view = engine.getPublicView(state, { type: 'player', playerId });
    const listed = listOptions(view, playerId)
      .filter((action) => action.type !== 'DISCARD')
      .map(sortedKeys)
      .sort();
    const accepted = everything
      .filter((action) => validate(state, action, playerId).valid)
      .map(sortedKeys)
      .sort();
    expect(accepted).toEqual(listed);
  }
}

const GAMES = [
  { seed: 'alpha', players: 3 },
  { seed: 'bravo', players: 4 },
  { seed: 'charlie', players: 3 },
  { seed: 'delta', players: 4 },
];

describe('whole games', () => {
  it.each(GAMES)('$players players, seed $seed: sound after every action', ({ seed, players }) => {
    let steps = 0;
    const script = scriptFullGame(seed, players, engine.defaultConfig, undefined, (state) => {
      expectSound(state);
      if (steps % 7 === 0) expectLegalMatchesValidator(state);
      steps += 1;
    });
    expect(script.length).toBeGreaterThan(players * 4);
  });

  it.each(GAMES)('$players players, seed $seed: replays to the same end', ({ seed, players }) => {
    const actions = scriptFullGame(seed, players);
    const input = { seed, players: seats(players), actions };

    const final = runMatch(engine, input);

    expect(final).toEqual(runMatch(engine, input));
    expect(final.phase).toBe('FINISHED');
    const [winnerId] = final.winnerPlayerIds;
    expect(winnerId).toBe(final.turn.activePlayerId);
    expect(getPoints(final, winnerId as string)).toBeGreaterThanOrEqual(10);
    for (const playerId of final.turnOrder) {
      if (playerId !== winnerId) expect(getPoints(final, playerId)).toBeLessThan(10);
    }
  });

  it('plays the beginner board too', () => {
    const settings = { boardSetup: 'beginner' as const };
    const actions = scriptFullGame('echo', 4, engine.defaultConfig, settings);
    const final = runMatch(engine, { seed: 'echo', players: seats(4), actions, settings });
    expect(final.phase).toBe('FINISHED');
    expect(final.tiles['0,0']).toEqual({ terrain: 'desert', number: null });
  });

  it('survives being saved and loaded in the middle', () => {
    const actions = scriptFullGame('foxtrot', 3);
    const half = Math.floor(actions.length / 2);
    const players = seats(3);
    const midway = runMatch(engine, { seed: 'foxtrot', players, actions: actions.slice(0, half) });

    let state = JSON.parse(JSON.stringify(midway)) as CatanState;
    expect(state).toEqual(midway);
    for (const step of actions.slice(half)) {
      state = engine.applyAction(state, step.action, context(step.playerId));
    }
    expect(state).toEqual(runMatch(engine, { seed: 'foxtrot', players, actions }));
  });

  it('plays offers, answers and discards out of turn', () => {
    const types = new Set<string>();
    for (const { seed, players } of GAMES) {
      for (const step of scriptFullGame(seed, players)) types.add(step.action.type);
    }
    for (const type of [
      'PROPOSE_TRADE',
      'RESPOND_TRADE',
      'CANCEL_TRADE',
      'DISCARD',
      'MOVE_ROBBER',
    ]) {
      expect(types).toContain(type);
    }
  });
});
