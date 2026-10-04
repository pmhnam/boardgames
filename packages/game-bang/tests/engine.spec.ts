import { createSeededRandom } from '@bgp/game-core';
import { runMatch, seats } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { BangAction } from '../src/domain/actions.js';
import { CHARACTER_IDS } from '../src/domain/characters.js';
import { BangRuleCodes } from '../src/domain/errors.js';
import { PLAYER_COUNTS, getRoleCounts } from '../src/domain/game-config.js';
import { ROLE_IDS, type RoleCounts } from '../src/domain/roles.js';
import type { BangState } from '../src/domain/state.js';
import { BangBot } from '../src/index.js';
import {
  apply,
  asPlayer,
  engine,
  gameConfig,
  listAllCards,
  newGame,
  player,
} from './fixtures/states.js';

function countRoles(state: BangState): RoleCounts {
  const counts = Object.fromEntries(ROLE_IDS.map((role) => [role, 0])) as RoleCounts;
  for (const seat of Object.values(state.players)) counts[seat.role] += 1;
  return counts;
}

/** The actions an easy bot in every seat takes, which are any legal ones. */
function scriptMatch(playerCount: number, seed: string, maxActions = 3000) {
  const actions: Array<{ playerId: string; action: BangAction }> = [];
  const states: BangState[] = [newGame(playerCount, seed)];
  for (let step = 0; step < maxActions; step += 1) {
    const state = states.at(-1) as BangState;
    const [playerId] = engine.getCurrentPlayerIds(state);
    if (playerId === undefined) break;
    const action = BangBot.chooseAction({
      view: engine.getPublicView(state, asPlayer(playerId)),
      playerId,
      level: 'easy',
      random: createSeededRandom(`${seed}:${step}`),
    });
    actions.push({ playerId, action });
    states.push(apply(state, action, playerId));
  }
  return { actions, states };
}

describe('setup', () => {
  it.each(PLAYER_COUNTS)('deals %i players the roles of the config', (playerCount) => {
    const state = newGame(playerCount);
    expect(countRoles(state)).toEqual(getRoleCounts(gameConfig, playerCount));
    expect(state.setup.roleCounts).toEqual(countRoles(state));
    expect(state.seatOrder).toEqual(seats(playerCount).map((seat) => seat.playerId));
  });

  it('gives everyone a character of their own, its life, and a hand to match', () => {
    const state = newGame(7);
    const seated = Object.values(state.players);
    expect(new Set(seated.map((seat) => seat.character)).size).toBe(7);
    for (const playerId of state.seatOrder) {
      const seat = player(state, playerId);
      const life = gameConfig.characters[seat.character].life + (seat.role === 'sheriff' ? 1 : 0);
      expect(seat).toMatchObject({ alive: true, life, maxLife: life, inPlay: [] });
      // The sheriff has already drawn for the first turn.
      const drawn = playerId === state.turn.playerId ? seat.hand.length - life : 0;
      expect(seat.hand).toHaveLength(life + drawn);
    }
  });

  it('gives the sheriff the first turn, with the first two cards drawn', () => {
    for (const seed of ['one', 'two', 'three', 'four', 'five']) {
      const state = newGame(5, seed);
      const sheriffId = state.seatOrder.find((id) => player(state, id).role === 'sheriff');
      expect(state.turn).toMatchObject({ playerId: sheriffId, number: 1 });
      expect(engine.getCurrentPlayerIds(state)).toEqual([sheriffId]);
      expect(engine.getGameStatus(state)).toBe('playing');
      expect(engine.getResult(state)).toBeNull();
    }
  });

  it('puts every card of the deck somewhere, once', () => {
    const state = newGame(6);
    const all = listAllCards(state);
    expect(all).toHaveLength(80);
    expect(new Set(all).size).toBe(80);
    expect(state.discard).toEqual([]);
  });

  it('deals the same for the same seed, and otherwise for another', () => {
    expect(newGame(6, 'one')).toEqual(newGame(6, 'one'));
    const deal = (seed: string) =>
      Object.values(newGame(6, seed).players)
        .map((seat) => `${seat.role}/${seat.character}`)
        .join();
    expect(['two', 'three', 'four'].some((seed) => deal(seed) !== deal('one'))).toBe(true);
  });

  it('deals every character sooner or later', () => {
    const dealt = new Set<string>();
    for (let index = 0; index < 40; index += 1) {
      for (const seat of Object.values(newGame(7, `seed-${index}`).players))
        dealt.add(seat.character);
    }
    expect([...dealt].sort()).toEqual([...CHARACTER_IDS].sort());
  });

  it('seats players by seat, whatever order they are given in', () => {
    const state = engine.createInitialState({
      gameId: 'g',
      players: [...seats(5)].reverse(),
      seed: 'seed',
      config: gameConfig,
      settings: {},
    });
    expect(state.seatOrder).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
  });

  it.each([3, 8])('refuses a table of %i', (playerCount) => {
    expect(() =>
      engine.createInitialState({
        gameId: 'g',
        players: seats(playerCount),
        seed: 'seed',
        config: gameConfig,
        settings: {},
      }),
    ).toThrowError(expect.objectContaining({ code: BangRuleCodes.InvalidPlayerCount }));
  });
});

describe('parseAction', () => {
  it('copies the fields it knows and drops the rest', () => {
    expect(
      engine.parseAction({ type: 'PLAY_CARD', cardId: 'c1', targetId: 'p2', cheat: true }),
    ).toEqual({
      ok: true,
      action: { type: 'PLAY_CARD', cardId: 'c1', targetId: 'p2', targetCardId: null },
    });
    expect(engine.parseAction({ type: 'END_TURN', winner: 'me' })).toEqual({
      ok: true,
      action: { type: 'END_TURN', discardIds: [] },
    });
    expect(engine.parseAction({ type: 'RESPOND' })).toEqual({
      ok: true,
      action: { type: 'RESPOND', cardId: null },
    });
    expect(engine.parseAction({ type: 'PICK_CARDS', cardIds: ['c1', 'c2'] })).toEqual({
      ok: true,
      action: { type: 'PICK_CARDS', cardIds: ['c1', 'c2'] },
    });
    expect(engine.parseAction({ type: 'DRAW', source: 'player', targetId: 'p3' })).toEqual({
      ok: true,
      action: { type: 'DRAW', source: 'player', targetId: 'p3' },
    });
    expect(engine.parseAction({ type: 'DISCARD_TO_HEAL', cardIds: ['c1', 'c2'] })).toEqual({
      ok: true,
      action: { type: 'DISCARD_TO_HEAL', cardIds: ['c1', 'c2'] },
    });
  });

  it.each([
    null,
    'END_TURN',
    [],
    {},
    { type: 'WIN' },
    { type: 'PLAY_CARD' },
    { type: 'PLAY_CARD', cardId: 3 },
    { type: 'PLAY_CARD', cardId: 'c1', targetId: 2 },
    { type: 'PLAY_CARD', cardId: 'c1', targetCardId: {} },
    { type: 'END_TURN', discardIds: 'c1' },
    { type: 'END_TURN', discardIds: [1] },
    { type: 'END_TURN', discardIds: Array.from({ length: 41 }, () => 'c1') },
    { type: 'RESPOND', cardId: 7 },
    { type: 'PICK_CARDS' },
    { type: 'DISCARD_TO_HEAL', cardIds: 'c1' },
    { type: 'DRAW' },
    { type: 'DRAW', source: 'sleeve' },
    { type: 'DRAW', source: 'player', targetId: 1 },
  ])('refuses %j', (raw) => {
    expect(engine.parseAction(raw)).toMatchObject({ ok: false });
  });
});

describe('whole matches', () => {
  const seeds = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];

  it.each(seeds)('keep their books straight from first card to last (%s)', (seed) => {
    const { states } = scriptMatch(4 + (seed.length % 4), seed);
    const last = states.at(-1) as BangState;
    expect(engine.getGameStatus(last)).toBe('finished');

    let turn = 0;
    for (const state of states) {
      // Every card is in exactly one place.
      const all = listAllCards(state);
      expect(all).toHaveLength(80);
      expect(new Set(all).size).toBe(80);

      for (const seat of Object.values(state.players)) {
        expect(seat.life).toBeLessThanOrEqual(seat.maxLife);
        if (seat.alive) expect(seat.life).toBeGreaterThanOrEqual(0);
        else expect(seat).toMatchObject({ life: 0, hand: [], inPlay: [] });
        // Nobody has two cards of the same name in play.
        const names = seat.inPlay.map((cardId) => state.cards[cardId]?.kind);
        expect(new Set(names).size).toBe(names.length);
      }

      expect(state.turn.number).toBeGreaterThanOrEqual(turn);
      turn = state.turn.number;
      const waiting = engine.getCurrentPlayerIds(state);
      if (state.phase === 'PLAYING') {
        expect(waiting).toHaveLength(1);
        // A living player, or Sid Ketchum deciding whether to stay one.
        expect(player(state, waiting[0] ?? '').alive).toBe(true);
        expect(engine.getResult(state)).toBeNull();
      } else {
        expect(waiting).toEqual([]);
      }
      expect(state.log.length).toBeLessThanOrEqual(100);
    }
  });

  it('end with a winning side that fits who is left', () => {
    for (const seed of seeds) {
      const last = scriptMatch(5, `end-${seed}`).states.at(-1) as BangState;
      const alive = Object.values(last.players).filter((seat) => seat.alive);
      const sheriffAlive = alive.some((seat) => seat.role === 'sheriff');
      expect(last.winner === 'law').toBe(sheriffAlive);
      expect(engine.getResult(last)?.winnerPlayerIds).toEqual(last.winnerPlayerIds);
      expect(last.winnerPlayerIds.length).toBeGreaterThan(0);
      if (last.winner === 'renegade') {
        expect(alive.map((seat) => seat.role)).toEqual(['renegade']);
      }
    }
  });

  it('replay to the same state from the same seed and actions', () => {
    const { actions, states } = scriptMatch(6, 'replay');
    const replayed = runMatch(engine, { seed: 'replay', players: seats(6), actions });
    expect({ ...replayed, id: 'g' }).toEqual(states.at(-1));
    // Another seed deals another match, in which the first action of this one need not be legal.
    expect(newGame(6, 'other')).not.toEqual(states[0]);
  });
});
