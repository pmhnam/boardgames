import { describe, expect, it } from 'vitest';
import { AvalonRuleCodes } from '../src/domain/errors.js';
import {
  engine,
  expectRejected,
  leader,
  propose,
  runQuest,
  table,
  vote,
} from './fixtures/states.js';

describe('proposing a team', () => {
  it('moves to the vote with the team in seat order', () => {
    const state = propose(table(), ['p4', 'p2']);
    expect(state.phase).toBe('TEAM_VOTE');
    expect(state.current).toEqual({ team: ['p2', 'p4'], votes: {}, cards: {} });
  });

  it('is the leader’s alone', () => {
    const state = table();
    expect(leader(state)).toBe('p1');
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p1']);
    expectRejected(
      state,
      { type: 'PROPOSE_TEAM', team: ['p2', 'p3'] },
      AvalonRuleCodes.NotYourTurn,
      'p2',
    );
  });

  it.each([
    ['too few players', ['p1']],
    ['too many players', ['p1', 'p2', 'p3']],
    ['the same player twice', ['p1', 'p1']],
    ['someone not at the table', ['p1', 'p9']],
  ])('refuses %s', (_, team) => {
    expectRejected(table(), { type: 'PROPOSE_TEAM', team }, AvalonRuleCodes.InvalidTeam, 'p1');
  });

  it('asks for the team size of the quest in progress', () => {
    let state = table();
    for (const size of [2, 3, 2]) {
      expect(
        engine.getPublicView(state, { type: 'player', playerId: leader(state) }).legal,
      ).toEqual(expect.objectContaining({ propose: { teamSize: size } }));
      state = runQuest(state);
    }
  });

  it('is refused while a team is being voted on', () => {
    const state = propose(table());
    expectRejected(
      state,
      { type: 'PROPOSE_TEAM', team: ['p1', 'p2'] },
      AvalonRuleCodes.WrongPhase,
      'p1',
    );
  });

  it('passes the lead one seat on after every vote, approved or not', () => {
    let state = table();
    state = vote(propose(state), true);
    expect(leader(state)).toBe('p2');
    state = runQuest(state);
    expect(leader(state)).toBe('p3');
  });

  it('comes back round to the first seat', () => {
    let state = table();
    for (const expected of ['p1', 'p2', 'p3', 'p4']) {
      expect(leader(state)).toBe(expected);
      state = vote(propose(state), true);
    }
    expect(leader(state)).toBe('p5');
    state = runQuest(state);
    expect(leader(state)).toBe('p1');
  });
});
