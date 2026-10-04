import { describe, expect, it } from 'vitest';
import { AvalonRuleCodes } from '../src/domain/errors.js';
import type { AvalonState } from '../src/domain/state.js';
import { apply, engine, expectRejected, newGame, runQuest, table } from './fixtures/states.js';

const asPlayer = (playerId: string) => ({ type: 'player', playerId }) as const;
const useLady = (targetId: string) => ({ type: 'USE_LADY', targetId }) as const;

/**
 * Five players with the Lady: p1 Merlin, p2 and p3 Loyal Servants, p4 the Assassin, p5 a
 * Minion who holds her first. One quest each way has been played.
 */
function afterTwoQuests(): AvalonState {
  const first = runQuest(table({ lady: true }));
  return runQuest(first, { team: ['p1', 'p2', 'p4'], failing: ['p4'] });
}

describe('the Lady of the Lake', () => {
  it('is left out unless the host asks for her', () => {
    let state = table();
    expect(state.lady).toBeNull();
    expect(engine.getPublicView(state, asPlayer('p5')).lady).toBeNull();
    state = runQuest(runQuest(state), { team: ['p1', 'p2', 'p4'], failing: ['p4'] });
    expect(state.phase).toBe('TEAM_PROPOSAL');
    expectRejected(state, useLady('p1'), AvalonRuleCodes.WrongPhase, 'p5');
  });

  it.each(['a', 'b', 'c', 'd'])(
    'starts with the seat before the first leader (seed %s)',
    (seed) => {
      const state = newGame({ seed, players: 7, lady: true });
      const before = (state.firstLeaderIndex + 6) % 7;
      expect(state.lady).toEqual({ holderId: state.seatOrder[before], inspections: [] });
    },
  );

  it('is not used after the first quest', () => {
    expect(runQuest(table({ lady: true })).phase).toBe('TEAM_PROPOSAL');
  });

  it('is used by her holder after the second quest', () => {
    const state = afterTwoQuests();
    expect(state.phase).toBe('LADY');
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p5']);
    expect(engine.getPublicView(state, asPlayer('p5')).legal.ladyTargets).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
    ]);
    expect(engine.getPublicView(state, asPlayer('p1')).legal.ladyTargets).toEqual([]);
    expectRejected(state, useLady('p2'), AvalonRuleCodes.NotYourTurn, 'p1');
    expectRejected(
      state,
      { type: 'PROPOSE_TEAM', team: ['p1', 'p2'] },
      AvalonRuleCodes.WrongPhase,
      'p3',
    );
  });

  it('cannot be turned on her holder or on nobody', () => {
    const state = afterTwoQuests();
    expectRejected(state, useLady('p5'), AvalonRuleCodes.InvalidTarget, 'p5');
    expectRejected(state, useLady('p9'), AvalonRuleCodes.InvalidTarget, 'p5');
  });

  it('passes to the player looked at, and the game goes on', () => {
    const state = apply(afterTwoQuests(), useLady('p1'), 'p5');
    expect(state.phase).toBe('TEAM_PROPOSAL');
    expect(state.lady).toEqual({
      holderId: 'p1',
      inspections: [{ holderId: 'p5', targetId: 'p1' }],
    });
  });

  it('shows the side only to the player who looked', () => {
    const state = apply(afterTwoQuests(), useLady('p1'), 'p5');
    expect(engine.getPublicView(state, asPlayer('p5')).lady?.inspections).toEqual([
      { holderId: 'p5', targetId: 'p1', alignment: 'GOOD' },
    ]);
    for (const viewer of [asPlayer('p1'), asPlayer('p4'), { type: 'spectator' } as const]) {
      expect(engine.getPublicView(state, viewer).lady?.inspections).toEqual([
        { holderId: 'p5', targetId: 'p1', alignment: null },
      ]);
    }
  });

  it('shows Mordred as evil', () => {
    // Seven players: p1 Merlin, p2 to p4 Loyal Servants, p5 the Assassin, p6 Mordred, p7 a Minion.
    const start = table({ players: 7, roles: ['MORDRED'], lady: true });
    const state = apply(runQuest(runQuest(start)), useLady('p6'), 'p7');
    expect(engine.getPublicView(state, asPlayer('p7')).lady?.inspections[0]?.alignment).toBe(
      'EVIL',
    );
  });

  it('cannot be turned on anyone who has held her', () => {
    const second = apply(afterTwoQuests(), useLady('p1'), 'p5');
    const state = runQuest(second);
    expect(state.phase).toBe('LADY');
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p1']);
    expect(engine.getPublicView(state, asPlayer('p1')).legal.ladyTargets).toEqual([
      'p2',
      'p3',
      'p4',
    ]);
    expectRejected(state, useLady('p5'), AvalonRuleCodes.LadyAlreadyHeld, 'p1');
  });

  it('is used after the third and fourth quests too, but not once the quests are decided', () => {
    let state = apply(afterTwoQuests(), useLady('p1'), 'p5');
    state = apply(runQuest(state), useLady('p2'), 'p1');
    state = runQuest(state, { team: ['p1', 'p2', 'p4'], failing: ['p4'] });
    expect(state.phase).toBe('LADY');
    state = apply(state, useLady('p3'), 'p2');
    expect(runQuest(state).phase).toBe('ASSASSINATION');

    // The third quest is one she follows, but here it gives good its three.
    const second = runQuest(runQuest(table({ lady: true })));
    expect(second.phase).toBe('LADY');
    expect(runQuest(apply(second, useLady('p1'), 'p5')).phase).toBe('ASSASSINATION');
  });
});
