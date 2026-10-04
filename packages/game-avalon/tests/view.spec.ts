import type { GameViewer } from '@bgp/game-core';
import { deepFreeze } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { Role } from '../src/domain/roles.js';
import type { AvalonState } from '../src/domain/state.js';
import { NO_LEGAL_MOVES } from '../src/rules/legal-moves.js';
import { apply, engine, playQuest, propose, runQuest, table, vote } from './fixtures/states.js';

const SPECTATOR: GameViewer = { type: 'spectator' };
const ADMIN: GameViewer = { type: 'admin' };
const asPlayer = (playerId: string): GameViewer => ({ type: 'player', playerId });
const viewOf = (state: AvalonState, viewer: GameViewer) =>
  JSON.stringify(engine.getPublicView(state, viewer));

/** The same game with two players' roles swapped. */
function swapRoles(state: AvalonState, a: string, b: string): AvalonState {
  const roles = { ...state.roles, [a]: state.roles[b] as Role, [b]: state.roles[a] as Role };
  return deepFreeze({ ...state, roles });
}

/**
 * Ten players with every role: p1 Merlin, p2 Percival, p3 to p6 Loyal Servants, p7 the
 * Assassin, p8 Morgana, p9 Mordred, p10 Oberon.
 */
const fullTable = () =>
  table({ players: 10, roles: ['PERCIVAL', 'MORGANA', 'MORDRED', 'OBERON'], lady: true });

describe('what each role is shown', () => {
  const evil = (...playerIds: string[]) => playerIds.map((playerId) => ({ playerId, as: 'EVIL' }));

  it.each([
    ['Merlin sees evil, but not Mordred', 'p1', 'MERLIN', evil('p7', 'p8', 'p10')],
    [
      'Percival sees Merlin and Morgana, not which is which',
      'p2',
      'PERCIVAL',
      [
        { playerId: 'p1', as: 'MERLIN_OR_MORGANA' },
        { playerId: 'p8', as: 'MERLIN_OR_MORGANA' },
      ],
    ],
    ['a Loyal Servant sees nobody', 'p3', 'LOYAL_SERVANT', []],
    ['the Assassin sees evil, but not Oberon', 'p7', 'ASSASSIN', evil('p8', 'p9')],
    ['Morgana sees evil, but not Oberon', 'p8', 'MORGANA', evil('p7', 'p9')],
    ['Mordred sees evil, but not Oberon', 'p9', 'MORDRED', evil('p7', 'p8')],
    ['Oberon sees nobody', 'p10', 'OBERON', []],
  ])('%s', (_, playerId, role, knowledge) => {
    const you = engine.getPublicView(fullTable(), asPlayer(playerId)).you;
    expect(you).toMatchObject({ role, knowledge });
    expect(you?.alignment).toBe(['p7', 'p8', 'p9', 'p10'].includes(playerId) ? 'EVIL' : 'GOOD');
  });

  it('shows a Minion the other evil players', () => {
    const you = engine.getPublicView(table(), asPlayer('p5')).you;
    expect(you).toMatchObject({ role: 'MINION', knowledge: evil('p4') });
  });

  it('lists what Percival sees in seat order, whoever is Merlin', () => {
    const swapped = swapRoles(fullTable(), 'p1', 'p8');
    expect(viewOf(swapped, asPlayer('p2'))).toBe(viewOf(fullTable(), asPlayer('p2')));
  });

  it('lists the roles in play without saying who holds them', () => {
    const view = engine.getPublicView(table({ players: 7, roles: ['MORGANA'] }), SPECTATOR);
    expect(view.rolesInPlay).toEqual([
      'MERLIN',
      'LOYAL_SERVANT',
      'LOYAL_SERVANT',
      'LOYAL_SERVANT',
      'ASSASSIN',
      'MORGANA',
      'MINION',
    ]);
  });
});

describe('what stays hidden', () => {
  it('gives anyone not seated no role, no knowledge and nothing to do', () => {
    const state = propose(fullTable());
    for (const viewer of [SPECTATOR, ADMIN, asPlayer('p99')]) {
      const view = engine.getPublicView(state, viewer);
      expect(view.you).toBeNull();
      expect(view.roles).toBeNull();
      expect(view.legal).toEqual(NO_LEGAL_MOVES);
      expect(view).not.toHaveProperty('current');
      expect(view).not.toHaveProperty('firstLeaderIndex');
    }
    expect(viewOf(state, ADMIN)).toBe(viewOf(state, SPECTATOR));
  });

  it('shows the table the same game however the roles fell', () => {
    const state = fullTable();
    const swapped = swapRoles(swapRoles(state, 'p1', 'p9'), 'p3', 'p7');
    expect(viewOf(swapped, SPECTATOR)).toBe(viewOf(state, SPECTATOR));
    // A Loyal Servant, and Oberon, learn nothing from it either.
    const others = swapRoles(swapRoles(state, 'p1', 'p9'), 'p4', 'p7');
    expect(viewOf(others, asPlayer('p3'))).toBe(viewOf(state, asPlayer('p3')));
    expect(viewOf(others, asPlayer('p10'))).toBe(viewOf(state, asPlayer('p10')));
  });

  it('keeps Mordred from Merlin and Oberon from the rest of evil', () => {
    const state = fullTable();
    expect(viewOf(swapRoles(state, 'p9', 'p3'), asPlayer('p1'))).toBe(
      viewOf(state, asPlayer('p1')),
    );
    expect(viewOf(swapRoles(state, 'p10', 'p3'), asPlayer('p7'))).toBe(
      viewOf(state, asPlayer('p7')),
    );
  });

  it('shows who has voted but not how, until the last vote is in', () => {
    const start = propose(table());
    const cast = (approve: boolean) =>
      apply(
        apply(start, { type: 'VOTE', proposal: 0, approve }, 'p2'),
        { type: 'VOTE', proposal: 0, approve: !approve },
        'p4',
      );

    const view = engine.getPublicView(cast(true), asPlayer('p1'));
    expect(view.voted).toEqual(['p2', 'p4']);
    expect(view.proposals).toEqual([]);
    for (const viewer of [asPlayer('p1'), asPlayer('p3'), SPECTATOR, ADMIN]) {
      expect(viewOf(cast(true), viewer)).toBe(viewOf(cast(false), viewer));
    }

    expect(engine.getPublicView(cast(true), asPlayer('p2')).you?.vote).toBe(true);
    expect(engine.getPublicView(cast(false), asPlayer('p2')).you?.vote).toBe(false);
    expect(engine.getPublicView(cast(true), asPlayer('p1')).you?.vote).toBeNull();
  });

  it('shows every vote once the team is settled', () => {
    const state = vote(propose(table()), ['p3']);
    expect(engine.getPublicView(state, SPECTATOR).proposals).toEqual([
      {
        quest: 0,
        leaderId: 'p1',
        team: ['p1', 'p2'],
        votes: { p1: true, p2: true, p3: false, p4: true, p5: true },
        approved: true,
      },
    ]);
  });

  it('shows who has played a quest card but not which', () => {
    // p4 is the Assassin and p5 a Minion: either may fail the quest.
    const start = vote(propose(table(), ['p4', 'p5']));
    const played = (success: boolean) =>
      apply(start, { type: 'PLAY_QUEST_CARD', quest: 0, success }, 'p4');

    expect(engine.getPublicView(played(false), SPECTATOR).played).toEqual(['p4']);
    for (const viewer of [asPlayer('p1'), asPlayer('p5'), SPECTATOR, ADMIN]) {
      expect(viewOf(played(false), viewer)).toBe(viewOf(played(true), viewer));
    }
    expect(engine.getPublicView(played(false), asPlayer('p4')).you?.questCard).toBe(false);
  });

  it('announces how many Fails a quest got, never whose', () => {
    const start = vote(propose(table(), ['p4', 'p5']));
    const failedBy = (playerId: string) => playQuest(start, [playerId]);

    const view = engine.getPublicView(failedBy('p4'), SPECTATOR);
    expect(view.quests[0]?.result).toEqual({
      leaderId: 'p1',
      team: ['p4', 'p5'],
      fails: 1,
      success: false,
      cards: null,
    });
    for (const viewer of [asPlayer('p1'), asPlayer('p4'), asPlayer('p5'), SPECTATOR, ADMIN]) {
      expect(viewOf(failedBy('p4'), viewer)).toBe(viewOf(failedBy('p5'), viewer));
    }
  });

  it('offers Fail only to the evil side', () => {
    const state = vote(propose(table(), ['p2', 'p4']));
    expect(engine.getPublicView(state, asPlayer('p2')).legal.quest).toEqual({
      quest: 0,
      canFail: false,
    });
    expect(engine.getPublicView(state, asPlayer('p4')).legal.quest).toEqual({
      quest: 0,
      canFail: true,
    });
    expect(engine.getPublicView(state, asPlayer('p1')).legal).toEqual(NO_LEGAL_MOVES);
  });
});

describe('once the game is over', () => {
  it('shows everything to everyone', () => {
    let state = table();
    for (const team of [
      ['p1', 'p4'],
      ['p1', 'p2', 'p4'],
      ['p1', 'p4'],
    ]) {
      state = runQuest(state, { team, failing: ['p4'] });
    }
    for (const viewer of [asPlayer('p1'), asPlayer('p4'), SPECTATOR, ADMIN]) {
      const view = engine.getPublicView(state, viewer);
      expect(view.roles).toEqual({
        p1: 'MERLIN',
        p2: 'LOYAL_SERVANT',
        p3: 'LOYAL_SERVANT',
        p4: 'ASSASSIN',
        p5: 'MINION',
      });
      expect(view.quests[1]?.result?.cards).toEqual({ p1: true, p2: true, p4: false });
      expect(view.assassinId).toBe('p4');
      expect(view.winnerPlayerIds).toEqual(['p4', 'p5']);
      expect(view.leaderId).toBeNull();
      expect(view.legal).toEqual(NO_LEGAL_MOVES);
    }
  });
});
