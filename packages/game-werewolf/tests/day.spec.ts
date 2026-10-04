import { describe, expect, it } from 'vitest';
import { WerewolfRuleCodes } from '../src/domain/errors.js';
import type { RoleId } from '../src/domain/roles.js';
import {
  alive,
  apply,
  engine,
  expectRejected,
  lastLog,
  legalFor,
  newGame,
  openVote,
  playDay,
  playNight,
} from './fixtures/states.js';

const CAST: RoleId[] = [
  'werewolf',
  'werewolf',
  'seer',
  'bodyguard',
  'witch',
  'villager',
  'villager',
  'villager',
];

/** The first morning: p8 died in the night, seven are left. */
const morning = () => playNight(newGame(CAST), { attack: 'p8', protect: 'p4' });

describe('the discussion', () => {
  it('ends once more than half of the living are done talking', () => {
    let state = morning();
    expect(state.phase).toBe('DAY_DISCUSSION');
    for (const playerId of ['p1', 'p2', 'p3']) {
      state = apply(state, { type: 'READY_TO_VOTE' }, playerId);
    }
    expect(state.phase).toBe('DAY_DISCUSSION');
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p4', 'p5', 'p6', 'p7']);

    state = apply(state, { type: 'READY_TO_VOTE' }, 'p4');
    expect(state.phase).toBe('DAY_VOTE');
  });

  it('is closed to the dead, and to anyone already done', () => {
    const state = apply(morning(), { type: 'READY_TO_VOTE' }, 'p1');
    expectRejected(state, { type: 'READY_TO_VOTE' }, WerewolfRuleCodes.NotYourTurn, 'p8');
    expectRejected(state, { type: 'READY_TO_VOTE' }, WerewolfRuleCodes.NotYourTurn, 'p1');
  });

  it('takes no votes yet', () => {
    expectRejected(
      morning(),
      { type: 'CAST_VOTE', targetId: 'p1' },
      WerewolfRuleCodes.WrongAction,
      'p2',
    );
  });
});

describe('the vote', () => {
  it('executes the player with the most votes, and night falls', () => {
    const night = playDay(morning(), 'p1');
    expect(alive(night)).not.toContain('p1');
    expect(lastLog(night)).toEqual({
      type: 'VOTE',
      round: 1,
      votes: [
        { voterId: 'p1', targetId: null },
        ...['p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((voterId) => ({ voterId, targetId: 'p1' })),
      ],
      executedId: 'p1',
      spared: false,
      powersLost: false,
      deaths: ['p1'],
    });
    expect(night.phase).toBe('NIGHT');
    expect(night.round).toBe(2);
  });

  it('executes nobody on a tie', () => {
    const night = playDay(morning(), 'p6', { p4: 'p7', p5: 'p7', p6: 'p7', p7: null });
    expect(lastLog(night)).toMatchObject({ type: 'VOTE', executedId: null, deaths: [] });
    expect(alive(night)).toHaveLength(7);
  });

  it('executes nobody when sparing everyone has the most votes', () => {
    const night = playDay(morning(), null, { p1: 'p6', p2: 'p6' });
    expect(lastLog(night)).toMatchObject({ type: 'VOTE', executedId: null, deaths: [] });
  });

  it('needs more votes for a player than for sparing everyone', () => {
    const night = playDay(morning(), 'p6', { p4: null, p5: null, p6: null, p7: 'p1' });
    expect(lastLog(night)).toMatchObject({ type: 'VOTE', executedId: null });
  });

  it('refuses a vote for oneself, for the dead, and a second vote', () => {
    const state = openVote(morning());
    expect(legalFor(state, 'p2')).toEqual({
      action: 'CAST_VOTE',
      targets: ['p1', 'p3', 'p4', 'p5', 'p6', 'p7'],
      canSkip: true,
      canHeal: false,
    });
    for (const targetId of ['p2', 'p8', 'p99']) {
      expectRejected(state, { type: 'CAST_VOTE', targetId }, WerewolfRuleCodes.InvalidTarget, 'p2');
    }
    expectRejected(
      state,
      { type: 'CAST_VOTE', targetId: 'p1' },
      WerewolfRuleCodes.NotYourTurn,
      'p8',
    );

    const voted = apply(state, { type: 'CAST_VOTE', targetId: 'p1' }, 'p2');
    expectRejected(
      voted,
      { type: 'CAST_VOTE', targetId: 'p3' },
      WerewolfRuleCodes.NotYourTurn,
      'p2',
    );
    expect(engine.getCurrentPlayerIds(voted)).not.toContain('p2');
  });
});

describe('the idiot', () => {
  const VILLAGE: RoleId[] = ['werewolf', 'idiot', 'seer', 'villager', 'villager', 'villager'];
  const spared = () => playDay(playNight(newGame(VILLAGE), { attack: 'p6' }), 'p2');

  it('is spared the first time, shown to all, and never votes again', () => {
    const night = spared();
    expect(night.players.p2).toMatchObject({ alive: true, canVote: false, roleRevealed: true });
    expect(lastLog(night)).toMatchObject({
      type: 'VOTE',
      executedId: 'p2',
      spared: true,
      deaths: [],
    });

    const vote = openVote(playNight(night, { attack: 'p5' }));
    expect(engine.getCurrentPlayerIds(vote)).toEqual(['p1', 'p3', 'p4']);
    expectRejected(
      vote,
      { type: 'CAST_VOTE', targetId: 'p1' },
      WerewolfRuleCodes.NotYourTurn,
      'p2',
    );
  });

  it('still has a say in when the talking ends', () => {
    const day = playNight(spared(), { attack: 'p5' });
    expect(legalFor(day, 'p2').action).toBe('READY_TO_VOTE');
  });

  it('is executed the second time', () => {
    const second = playDay(playNight(spared(), { attack: 'p5' }), 'p2');
    expect(lastLog(second)).toMatchObject({ executedId: 'p2', spared: false, deaths: ['p2'] });
  });
});

describe('executing the elder', () => {
  const VILLAGE: RoleId[] = [
    'werewolf',
    'elder',
    'seer',
    'bodyguard',
    'witch',
    'hunter',
    'villager',
    'villager',
    'villager',
  ];
  const cursed = () => playDay(playNight(newGame(VILLAGE), { attack: 'p9', protect: 'p4' }), 'p2');

  it('costs the village its powers', () => {
    const night = cursed();
    expect(night.powersLost).toBe(true);
    expect(lastLog(night)).toMatchObject({ executedId: 'p2', powersLost: true, deaths: ['p2'] });

    for (const playerId of ['p3', 'p4', 'p5'])
      expect(legalFor(night, playerId).action).toBe('SLEEP');
    expectRejected(
      night,
      { type: 'SEER_INSPECT', targetId: 'p1' },
      WerewolfRuleCodes.WrongAction,
      'p3',
    );
  });

  it('leaves the witch asleep and the hunter without a shot', () => {
    const day = playNight(cursed(), { attack: 'p6' });
    // No witch step, no last shot: straight to the morning.
    expect(day.phase).toBe('DAY_DISCUSSION');
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 2, deaths: ['p6'] });
  });

  it('does not cost the pack its teeth', () => {
    expect(legalFor(cursed(), 'p1').action).toBe('WOLF_VOTE');
  });
});

describe('executing the hunter', () => {
  const VILLAGE: RoleId[] = ['werewolf', 'hunter', 'villager', 'villager', 'villager', 'villager'];

  it('lets them fire before night falls', () => {
    const shot = playDay(playNight(newGame(VILLAGE), { attack: 'p6' }), 'p2');
    expect(shot.phase).toBe('HUNTER_SHOT');
    expect(shot.round).toBe(1);

    const night = apply(shot, { type: 'HUNTER_SHOOT', targetId: 'p3' }, 'p2');
    expect(night.phase).toBe('NIGHT');
    expect(night.round).toBe(2);
    expect(alive(night)).toEqual(['p1', 'p4', 'p5']);
  });
});
