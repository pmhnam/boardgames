import { describe, expect, it } from 'vitest';
import { AvalonRuleCodes } from '../src/domain/errors.js';
import type { AvalonState } from '../src/domain/state.js';
import { apply, engine, expectRejected, runQuest, table } from './fixtures/states.js';

const asPlayer = (playerId: string) => ({ type: 'player', playerId }) as const;
const assassinate = (targetId: string) => ({ type: 'ASSASSINATE', targetId }) as const;

/** Five players: p1 Merlin, p2 and p3 Loyal Servants, p4 the Assassin, p5 a Minion. */
function goodHasItsQuests(): AvalonState {
  return runQuest(runQuest(runQuest(table())));
}

describe('the assassination', () => {
  it('keeps the Assassin unknown until good has its quests', () => {
    const before = runQuest(runQuest(table()));
    expect(engine.getPublicView(before, { type: 'spectator' }).assassinId).toBeNull();
    expectRejected(before, assassinate('p1'), AvalonRuleCodes.WrongPhase, 'p4');

    const state = goodHasItsQuests();
    for (const viewer of [asPlayer('p1'), asPlayer('p5'), { type: 'spectator' } as const]) {
      expect(engine.getPublicView(state, viewer).assassinId).toBe('p4');
    }
  });

  it('is the Assassin’s alone', () => {
    const state = goodHasItsQuests();
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p4']);
    expect(engine.getPublicView(state, asPlayer('p4')).legal.assassinTargets).toEqual([
      'p1',
      'p2',
      'p3',
      'p5',
    ]);
    expect(engine.getPublicView(state, asPlayer('p5')).legal.assassinTargets).toEqual([]);
    expectRejected(state, assassinate('p1'), AvalonRuleCodes.NotYourTurn, 'p5');
  });

  it('cannot name the Assassin or nobody', () => {
    const state = goodHasItsQuests();
    expectRejected(state, assassinate('p4'), AvalonRuleCodes.InvalidTarget, 'p4');
    expectRejected(state, assassinate('p9'), AvalonRuleCodes.InvalidTarget, 'p4');
  });

  it('wins the game for evil when Merlin is named', () => {
    const state = apply(goodHasItsQuests(), assassinate('p1'), 'p4');
    expect(state.phase).toBe('FINISHED');
    const view = engine.getPublicView(state, { type: 'spectator' });
    expect(view.outcome).toEqual({ winner: 'EVIL', reason: 'MERLIN_ASSASSINATED' });
    expect(view.assassinTargetId).toBe('p1');
    expect(view.winnerPlayerIds).toEqual(['p4', 'p5']);
    expect(engine.getResult(state)).toEqual({ winnerPlayerIds: ['p4', 'p5'] });
  });

  it.each(['p2', 'p5'])('leaves the game with good when %s is named instead', (targetId) => {
    const state = apply(goodHasItsQuests(), assassinate(targetId), 'p4');
    expect(engine.getPublicView(state, { type: 'spectator' }).outcome).toEqual({
      winner: 'GOOD',
      reason: 'MERLIN_SURVIVED',
    });
    expect(engine.getResult(state)).toEqual({ winnerPlayerIds: ['p1', 'p2', 'p3'] });
  });

  it('refuses everything once the game is over', () => {
    const state = apply(goodHasItsQuests(), assassinate('p2'), 'p4');
    expectRejected(state, assassinate('p1'), AvalonRuleCodes.GameNotPlaying, 'p4');
    expectRejected(
      state,
      { type: 'PROPOSE_TEAM', team: ['p1', 'p2'] },
      AvalonRuleCodes.GameNotPlaying,
      'p1',
    );
    expect(engine.getCurrentPlayerIds(state)).toEqual([]);
  });
});
