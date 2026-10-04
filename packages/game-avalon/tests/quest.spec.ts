import { describe, expect, it } from 'vitest';
import { AvalonRuleCodes } from '../src/domain/errors.js';
import {
  apply,
  engine,
  expectRejected,
  playQuest,
  propose,
  runQuest,
  table,
  validate,
  vote,
} from './fixtures/states.js';

const SUCCESS = { type: 'PLAY_QUEST_CARD', quest: 0, success: true } as const;
const FAIL = { type: 'PLAY_QUEST_CARD', quest: 0, success: false } as const;

/** Five players: p1 Merlin, p2 and p3 Loyal Servants, p4 the Assassin, p5 a Minion. */
const onQuest = (team: string[]) => vote(propose(table(), team));

describe('going on a quest', () => {
  it('waits for the whole team, and drops each member once they have played', () => {
    let state = onQuest(['p2', 'p4']);
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p2', 'p4']);
    state = apply(state, SUCCESS, 'p4');
    expect(state.phase).toBe('QUEST');
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p2']);
    expect(state.quests).toEqual([]);
  });

  it('is for team members only', () => {
    expectRejected(onQuest(['p2', 'p4']), SUCCESS, AvalonRuleCodes.NotYourTurn, 'p1');
  });

  it('refuses a second card from the same player', () => {
    const state = apply(onQuest(['p2', 'p4']), SUCCESS, 'p4');
    expectRejected(state, FAIL, AvalonRuleCodes.AlreadyPlayed, 'p4');
  });

  it('refuses a card for a quest that is over', () => {
    const state = vote(propose(runQuest(table()), ['p1', 'p2', 'p4']));
    expectRejected(state, SUCCESS, AvalonRuleCodes.StaleQuest, 'p4');
  });

  it('refuses a card before the team is approved', () => {
    expectRejected(propose(table()), SUCCESS, AvalonRuleCodes.WrongPhase, 'p1');
  });

  it('makes the good side play Success', () => {
    const state = onQuest(['p2', 'p4']);
    expectRejected(state, FAIL, AvalonRuleCodes.MustPlaySuccess, 'p2');
    expect(validate(state, FAIL, 'p4')).toEqual({ valid: true });
    expect(validate(state, SUCCESS, 'p4')).toEqual({ valid: true });
  });

  it('succeeds when nobody fails it, and moves on to the next team', () => {
    const state = playQuest(onQuest(['p2', 'p4']));
    expect(state.phase).toBe('TEAM_PROPOSAL');
    expect(state.quests).toEqual([
      { leaderId: 'p1', team: ['p2', 'p4'], cards: { p2: true, p4: true } },
    ]);
    expect(engine.getPublicView(state, { type: 'spectator' }).quests[0]?.result).toMatchObject({
      fails: 0,
      success: true,
    });
  });

  it('fails on a single Fail', () => {
    const state = playQuest(onQuest(['p2', 'p4']), ['p4']);
    expect(engine.getPublicView(state, { type: 'spectator' }).quests[0]?.result).toMatchObject({
      fails: 1,
      success: false,
    });
  });

  it('needs two Fails on the fourth quest at seven players', () => {
    // Seven players: p1 Merlin, p2 to p4 Loyal Servants, p5 the Assassin, p6 and p7 Minions.
    let state = table({ players: 7 });
    for (let quest = 0; quest < 2; quest += 1) state = runQuest(state);
    state = runQuest(state, { failing: ['p5'], team: ['p1', 'p2', 'p5'] });
    expect(state.rules.failsRequired[3]).toBe(2);

    const team = ['p1', 'p2', 'p5', 'p6'];
    const oneFail = runQuest(state, { team, failing: ['p5'] });
    expect(engine.getPublicView(oneFail, { type: 'spectator' }).quests[3]?.result).toMatchObject({
      fails: 1,
      success: true,
    });
    expect(oneFail.phase).toBe('ASSASSINATION');

    const twoFails = runQuest(state, { team, failing: ['p5', 'p6'] });
    expect(engine.getPublicView(twoFails, { type: 'spectator' }).quests[3]?.result).toMatchObject({
      fails: 2,
      success: false,
    });
    expect(twoFails.phase).toBe('TEAM_PROPOSAL');
  });

  it('ends the game for evil on the third failed quest', () => {
    let state = table();
    for (const team of [
      ['p1', 'p4'],
      ['p1', 'p2', 'p4'],
      ['p1', 'p4'],
    ]) {
      expect(state.phase).toBe('TEAM_PROPOSAL');
      state = runQuest(state, { team, failing: ['p4'] });
    }
    expect(state.phase).toBe('FINISHED');
    expect(engine.getGameStatus(state)).toBe('finished');
    expect(engine.getPublicView(state, { type: 'spectator' }).outcome).toEqual({
      winner: 'EVIL',
      reason: 'QUESTS_FAILED',
    });
    expect(engine.getResult(state)).toEqual({ winnerPlayerIds: ['p4', 'p5'] });
  });

  it('calls the Assassin forward on the third successful quest', () => {
    let state = table();
    state = runQuest(state, { team: ['p1', 'p4'], failing: ['p4'] });
    for (let quest = 0; quest < 3; quest += 1) {
      expect(state.phase).toBe('TEAM_PROPOSAL');
      state = runQuest(state);
    }
    expect(state.phase).toBe('ASSASSINATION');
    expect(engine.getResult(state)).toBeNull();
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p4']);
  });

  it('comes to the same state whatever order the cards arrive in', () => {
    const start = onQuest(['p2', 'p4']);
    const first = apply(apply(start, FAIL, 'p4'), SUCCESS, 'p2');
    const second = apply(apply(start, SUCCESS, 'p2'), FAIL, 'p4');
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
