import { describe, expect, it } from 'vitest';
import { WerewolfRuleCodes } from '../src/domain/errors.js';
import type { RoleId } from '../src/domain/roles.js';
import type { WerewolfState } from '../src/domain/state.js';
import {
  alive,
  apply,
  engine,
  expectRejected,
  newGame,
  playDay,
  playNight,
} from './fixtures/states.js';

const SMALL: RoleId[] = ['werewolf', 'seer', 'villager', 'villager', 'villager'];

/** A night and a day in which the village executes nobody. */
function quietRound(state: WerewolfState, attack: string): WerewolfState {
  const day = playNight(state, { attack });
  return day.phase === 'DAY_DISCUSSION' ? playDay(day, null) : day;
}

describe('winning', () => {
  it('goes to the village when the last werewolf is executed', () => {
    const end = playDay(playNight(newGame(SMALL), { attack: 'p5' }), 'p1');
    expect(end.phase).toBe('FINISHED');
    expect(end.winner).toBe('village');
    // The dead win with their side.
    expect(end.winnerPlayerIds).toEqual(['p2', 'p3', 'p4', 'p5']);

    expect(engine.getGameStatus(end)).toBe('finished');
    expect(engine.getCurrentPlayerIds(end)).toEqual([]);
    expect(engine.getResult(end)).toEqual({ winnerPlayerIds: ['p2', 'p3', 'p4', 'p5'] });
  });

  it('goes to the pack once it is half of those left', () => {
    let state = newGame(SMALL);
    expect(engine.getResult(state)).toBeNull();
    state = quietRound(state, 'p5');
    state = quietRound(state, 'p4');
    expect(state.phase).toBe('NIGHT');

    const end = playNight(state, { attack: 'p3' });
    expect(alive(end)).toEqual(['p1', 'p2']);
    expect(end.winner).toBe('werewolves');
    expect(end.winnerPlayerIds).toEqual(['p1']);
  });

  it('ends the match for good', () => {
    const end = playDay(playNight(newGame(SMALL), { attack: 'p5' }), 'p1');
    expectRejected(end, { type: 'SLEEP' }, WerewolfRuleCodes.GameNotPlaying, 'p2');
    expectRejected(end, { type: 'READY_TO_VOTE' }, WerewolfRuleCodes.GameNotPlaying, 'p2');
  });
});

describe('the hunter and the result', () => {
  const VILLAGE: RoleId[] = ['werewolf', 'hunter', 'villager', 'villager', 'villager'];
  /** Three left: the werewolf, the hunter and one villager. The pack attacks the hunter. */
  const lastStand = () => {
    const state = quietRound(quietRound(newGame(VILLAGE), 'p5'), 'p4');
    return playNight(state, { attack: 'p2' });
  };

  it('is called only after the last shot', () => {
    const shot = lastStand();
    // With the hunter dead the pack is half the table, but the hunter fires first.
    expect(shot.phase).toBe('HUNTER_SHOT');
    expect(shot.winner).toBeNull();

    const end = apply(shot, { type: 'HUNTER_SHOOT', targetId: 'p1' }, 'p2');
    expect(end.winner).toBe('village');
    expect(end.winnerPlayerIds).toEqual(['p2', 'p3', 'p4', 'p5']);
  });

  it('goes to the pack when the shot misses', () => {
    const end = apply(lastStand(), { type: 'HUNTER_SHOOT', targetId: 'p3' }, 'p2');
    expect(end.winner).toBe('werewolves');
    expect(end.winnerPlayerIds).toEqual(['p1']);
  });
});

describe('lovers', () => {
  const VILLAGE: RoleId[] = ['werewolf', 'cupid', 'villager', 'villager', 'villager', 'villager'];
  const linked = (couple: [string, string], attack: string) =>
    playNight(newGame(VILLAGE), { couple, attack });

  it('from opposite camps win alone, as the last two standing', () => {
    let state = playDay(linked(['p1', 'p3'], 'p6'), 'p5');
    state = playDay(playNight(state, { attack: 'p4' }), 'p2');

    expect(alive(state)).toEqual(['p1', 'p3']);
    expect(state.winner).toBe('lovers');
    expect(state.winnerPlayerIds).toEqual(['p1', 'p3']);
  });

  it('from opposite camps are left out when their old sides win', () => {
    const end = playDay(linked(['p1', 'p3'], 'p6'), 'p1');
    // The werewolf's lover died of grief: the village won without either of them.
    expect(alive(end)).toEqual(['p2', 'p4', 'p5']);
    expect(end.winner).toBe('village');
    expect(end.winnerPlayerIds).toEqual(['p2', 'p4', 'p5', 'p6']);
  });

  it('from the same camp win with it', () => {
    const end = playDay(linked(['p3', 'p4'], 'p6'), 'p1');
    expect(end.winner).toBe('village');
    expect(end.winnerPlayerIds).toEqual(['p2', 'p3', 'p4', 'p5', 'p6']);
  });
});

describe('a match nobody survives', () => {
  const VILLAGE: RoleId[] = ['werewolf', 'cupid', 'hunter', 'villager', 'villager', 'villager'];

  it('has no winner', () => {
    // The werewolf loves a villager; the hunter is the only other one left.
    let state = playNight(newGame(VILLAGE), { couple: ['p1', 'p4'], attack: 'p6' });
    state = playNight(playDay(state, 'p5'), { attack: 'p2' });
    state = playNight(playDay(state, null), { attack: 'p3' });
    expect(state.phase).toBe('HUNTER_SHOT');

    const end = apply(state, { type: 'HUNTER_SHOOT', targetId: 'p1' }, 'p3');
    expect(alive(end)).toEqual([]);
    expect(end.winner).toBe('nobody');
    expect(engine.getResult(end)).toEqual({ winnerPlayerIds: [] });
  });
});
