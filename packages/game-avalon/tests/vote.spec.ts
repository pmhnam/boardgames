import { describe, expect, it } from 'vitest';
import { AvalonRuleCodes } from '../src/domain/errors.js';
import {
  apply,
  engine,
  expectRejected,
  propose,
  runQuest,
  table,
  vote,
} from './fixtures/states.js';

const APPROVE = { type: 'VOTE', proposal: 0, approve: true } as const;
const REJECT = { type: 'VOTE', proposal: 0, approve: false } as const;

describe('voting on a team', () => {
  it('waits for everyone, and drops each voter from those still to act', () => {
    let state = propose(table());
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p1', 'p2', 'p3', 'p4', 'p5']);
    state = apply(state, APPROVE, 'p3');
    state = apply(state, REJECT, 'p1');
    expect(state.phase).toBe('TEAM_VOTE');
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p2', 'p4', 'p5']);
    expect(state.proposals).toEqual([]);
  });

  it('refuses a second vote from the same player', () => {
    const state = apply(propose(table()), APPROVE, 'p2');
    expectRejected(state, REJECT, AvalonRuleCodes.AlreadyVoted, 'p2');
  });

  it('refuses a vote for a proposal already settled', () => {
    const state = propose(vote(propose(table()), true));
    expectRejected(state, APPROVE, AvalonRuleCodes.StaleProposal, 'p1');
    expectRejected(
      state,
      { type: 'VOTE', proposal: 2, approve: true },
      AvalonRuleCodes.StaleProposal,
      'p1',
    );
  });

  it('refuses a vote before a team is proposed', () => {
    expectRejected(table(), APPROVE, AvalonRuleCodes.WrongPhase, 'p2');
  });

  it('refuses someone who is not at the table', () => {
    expectRejected(propose(table()), APPROVE, AvalonRuleCodes.NotYourTurn, 'p9');
  });

  it('sends the team on its quest on a majority', () => {
    const state = vote(propose(table()), ['p4', 'p5']);
    expect(state.phase).toBe('QUEST');
    expect(state.current).toEqual({ team: ['p1', 'p2'], votes: {}, cards: {} });
    expect(state.proposals).toEqual([
      {
        quest: 0,
        leaderId: 'p1',
        team: ['p1', 'p2'],
        votes: { p1: true, p2: true, p3: true, p4: false, p5: false },
        approved: true,
      },
    ]);
  });

  it('rejects the team on a tie', () => {
    const state = vote(propose(table({ players: 6 })), ['p1', 'p2', 'p3']);
    expect(state.phase).toBe('TEAM_PROPOSAL');
    expect(state.proposals[0]?.approved).toBe(false);
    expect(state.current.team).toBeNull();
  });

  it('hands evil the game on the fifth rejection in a row', () => {
    let state = table();
    for (let rejected = 1; rejected <= 4; rejected += 1) {
      state = vote(propose(state), true);
      expect(state.phase).toBe('TEAM_PROPOSAL');
      expect(engine.getPublicView(state, { type: 'spectator' }).rejections).toBe(rejected);
    }
    state = vote(propose(state), true);
    expect(state.phase).toBe('FINISHED');
    expect(engine.getPublicView(state, { type: 'spectator' }).outcome).toEqual({
      winner: 'EVIL',
      reason: 'TEAMS_REJECTED',
    });
    expect(engine.getResult(state)).toEqual({ winnerPlayerIds: ['p4', 'p5'] });
  });

  it('starts counting rejections again for the next quest', () => {
    let state = table();
    for (let rejected = 0; rejected < 4; rejected += 1) state = vote(propose(state), true);
    state = runQuest(state);
    expect(engine.getPublicView(state, { type: 'spectator' }).rejections).toBe(0);
    for (let rejected = 0; rejected < 4; rejected += 1) state = vote(propose(state), true);
    expect(state.phase).toBe('TEAM_PROPOSAL');
  });

  it('comes to the same state whatever order the votes arrive in', () => {
    const start = propose(table());
    const cast = (order: string[]) =>
      order.reduce(
        (state, playerId) =>
          apply(state, { type: 'VOTE', proposal: 0, approve: playerId !== 'p4' }, playerId),
        start,
      );
    const forwards = cast(['p1', 'p2', 'p3', 'p4', 'p5']);
    const shuffled = cast(['p4', 'p2', 'p5', 'p1', 'p3']);
    expect(JSON.stringify(shuffled)).toBe(JSON.stringify(forwards));

    const midway = (order: string[]) => JSON.stringify(cast(order));
    expect(midway(['p5', 'p1'])).toBe(midway(['p1', 'p5']));
  });
});
