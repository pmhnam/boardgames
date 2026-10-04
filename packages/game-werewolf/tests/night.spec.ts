import { describe, expect, it } from 'vitest';
import { WerewolfRuleCodes } from '../src/domain/errors.js';
import type { RoleId } from '../src/domain/roles.js';
import {
  alive,
  apply,
  asPlayer,
  configWith,
  engine,
  expectRejected,
  lastLog,
  legalFor,
  newGame,
  playDay,
  playNight,
  playUntilWitch,
} from './fixtures/states.js';

// p1 and p2 hunt; p3 sees, p4 guards, p5 brews; p6 to p8 are plain villagers.
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

describe('the night', () => {
  it('waits on every living player, whatever their role', () => {
    const state = newGame(CAST);
    expect(state.phase).toBe('NIGHT');
    expect(engine.getCurrentPlayerIds(state)).toEqual(state.seatOrder);

    const after = apply(state, { type: 'SLEEP' }, 'p6');
    expect(engine.getCurrentPlayerIds(after)).toEqual(state.seatOrder.filter((id) => id !== 'p6'));
  });

  it('asks each role for its own action and nothing else', () => {
    const state = newGame(CAST);
    expect(legalFor(state, 'p1').action).toBe('WOLF_VOTE');
    expect(legalFor(state, 'p3').action).toBe('SEER_INSPECT');
    expect(legalFor(state, 'p4').action).toBe('GUARD_PROTECT');
    expect(legalFor(state, 'p5').action).toBe('SLEEP');
    expect(legalFor(state, 'p6').action).toBe('SLEEP');

    expectRejected(state, { type: 'SLEEP' }, WerewolfRuleCodes.WrongAction, 'p1');
    expectRejected(
      state,
      { type: 'WOLF_VOTE', targetId: 'p7' },
      WerewolfRuleCodes.WrongAction,
      'p6',
    );
    expectRejected(state, { type: 'READY_TO_VOTE' }, WerewolfRuleCodes.WrongAction, 'p6');
  });

  it('takes one action from each player', () => {
    const state = apply(newGame(CAST), { type: 'SLEEP' }, 'p6');
    expectRejected(state, { type: 'SLEEP' }, WerewolfRuleCodes.NotYourTurn, 'p6');
  });

  it('refuses someone who is not in the match', () => {
    expectRejected(newGame(CAST), { type: 'SLEEP' }, WerewolfRuleCodes.NotYourTurn, 'p99');
  });

  it('kills the player the pack agrees on', () => {
    const day = playNight(newGame(CAST), { attack: 'p6', protect: 'p7' });
    expect(day.phase).toBe('DAY_DISCUSSION');
    expect(alive(day)).not.toContain('p6');
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: ['p6'] });
  });

  it('does not let a werewolf attack the pack or the dead', () => {
    const state = newGame(CAST);
    expect(legalFor(state, 'p1').targets).toEqual(['p3', 'p4', 'p5', 'p6', 'p7', 'p8']);
    for (const targetId of ['p1', 'p2', 'p99']) {
      expectRejected(state, { type: 'WOLF_VOTE', targetId }, WerewolfRuleCodes.InvalidTarget, 'p1');
    }

    const second = playDay(playNight(state, { attack: 'p6', protect: 'p7' }), null);
    expectRejected(
      second,
      { type: 'WOLF_VOTE', targetId: 'p6' },
      WerewolfRuleCodes.InvalidTarget,
      'p1',
    );
  });

  it('attacks nobody when the pack is split', () => {
    const split = apply(
      apply(newGame(CAST), { type: 'WOLF_VOTE', targetId: 'p6' }, 'p1'),
      { type: 'WOLF_VOTE', targetId: 'p7' },
      'p2',
    );
    const day = playNight(split, { protect: 'p8' });
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: [] });
  });
});

describe('the alpha werewolf', () => {
  const PACK: RoleId[] = ['alphaWerewolf', 'werewolf', ...CAST.slice(2)];
  const splitVote = (state = newGame(PACK)) =>
    apply(
      apply(state, { type: 'WOLF_VOTE', targetId: 'p6' }, 'p1'),
      { type: 'WOLF_VOTE', targetId: 'p7' },
      'p2',
    );

  it('settles a split vote', () => {
    const day = playNight(splitVote(), { protect: 'p8' });
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: ['p6'] });
  });

  it('counts for as much as the config says', () => {
    const config = configWith({ rules: { alphaVoteWeight: 1 } });
    const day = playNight(splitVote(newGame(PACK, { config })), { protect: 'p8' });
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: [] });
  });
});

describe('the seer', () => {
  it('learns whether the player they inspect is a werewolf', () => {
    const state = newGame(CAST);
    const found = apply(state, { type: 'SEER_INSPECT', targetId: 'p1' }, 'p3');
    expect(found.players.p3?.inspections).toEqual([{ round: 1, targetId: 'p1', isWolf: true }]);

    const cleared = apply(state, { type: 'SEER_INSPECT', targetId: 'p6' }, 'p3');
    expect(cleared.players.p3?.inspections).toEqual([{ round: 1, targetId: 'p6', isWolf: false }]);
  });

  it('cannot inspect themselves or the dead', () => {
    const state = newGame(CAST);
    expectRejected(
      state,
      { type: 'SEER_INSPECT', targetId: 'p3' },
      WerewolfRuleCodes.InvalidTarget,
      'p3',
    );

    const second = playDay(playNight(state, { attack: 'p6', protect: 'p7' }), null);
    expectRejected(
      second,
      { type: 'SEER_INSPECT', targetId: 'p6' },
      WerewolfRuleCodes.InvalidTarget,
      'p3',
    );
  });
});

describe('the bodyguard', () => {
  it('saves the player they watch', () => {
    const day = playNight(newGame(CAST), { attack: 'p6', protect: 'p6' });
    expect(alive(day)).toContain('p6');
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: [] });
  });

  it('cannot watch the same player two nights running', () => {
    const second = playDay(playNight(newGame(CAST), { attack: 'p6', protect: 'p6' }), null);
    expect(second.phase).toBe('NIGHT');
    expect(legalFor(second, 'p4').targets).not.toContain('p6');
    expectRejected(
      second,
      { type: 'GUARD_PROTECT', targetId: 'p6' },
      WerewolfRuleCodes.InvalidTarget,
      'p4',
    );

    const third = playDay(playNight(second, { attack: 'p7', protect: 'p7' }), null);
    expect(legalFor(third, 'p4').targets).toContain('p6');
    expect(legalFor(third, 'p4').targets).not.toContain('p7');
  });

  it('may watch themselves only when the config allows it', () => {
    expect(legalFor(newGame(CAST), 'p4').targets).toContain('p4');

    const strict = newGame(CAST, { config: configWith({ rules: { guardCanProtectSelf: false } }) });
    expect(legalFor(strict, 'p4').targets).not.toContain('p4');
    expectRejected(
      strict,
      { type: 'GUARD_PROTECT', targetId: 'p4' },
      WerewolfRuleCodes.InvalidTarget,
      'p4',
    );
  });
});

describe('the witch', () => {
  const view = (state: Parameters<typeof legalFor>[0]) =>
    engine.getPublicView(state, asPlayer('p5')).me;

  it('is woken once the others are done, and shown the victim', () => {
    const state = playUntilWitch(newGame(CAST), { attack: 'p6', protect: 'p7' });
    expect(state.phase).toBe('NIGHT');
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p5']);
    expect(view(state)?.attackedId).toBe('p6');
    expect(legalFor(state, 'p5')).toEqual({
      action: 'WITCH_DECIDE',
      targets: ['p1', 'p2', 'p3', 'p4', 'p6', 'p7', 'p8'],
      canSkip: true,
      canHeal: true,
    });
  });

  it('saves the victim with her healing potion, once', () => {
    const day = playNight(newGame(CAST), { attack: 'p6', protect: 'p7', heal: true });
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: [] });
    expect(day.players.p5?.healUsed).toBe(true);

    const second = playUntilWitch(playDay(day, null), { attack: 'p6', protect: 'p8' });
    expect(legalFor(second, 'p5').canHeal).toBe(false);
    // With no potion to save them, she is no longer told who was attacked.
    expect(view(second)?.attackedId).toBeNull();
    expectRejected(
      second,
      { type: 'WITCH_DECIDE', heal: true, poisonTargetId: null },
      WerewolfRuleCodes.HealNotAvailable,
      'p5',
    );
  });

  it('kills with her poison, once', () => {
    const day = playNight(newGame(CAST), { attack: 'p6', protect: 'p7', poison: 'p1' });
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: ['p1', 'p6'] });
    expect(day.players.p5?.poisonUsed).toBe(true);

    const second = playUntilWitch(playDay(day, null), { attack: 'p7', protect: 'p8' });
    expect(legalFor(second, 'p5').targets).toEqual([]);
    expectRejected(
      second,
      { type: 'WITCH_DECIDE', heal: false, poisonTargetId: 'p2' },
      WerewolfRuleCodes.PoisonNotAvailable,
      'p5',
    );
  });

  it('poisons through the bodyguard', () => {
    const day = playNight(newGame(CAST), { attack: 'p6', protect: 'p7', poison: 'p7' });
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: ['p6', 'p7'] });
  });

  it('cannot poison herself or someone who is not there', () => {
    const state = playUntilWitch(newGame(CAST), { attack: 'p6', protect: 'p7' });
    for (const poisonTargetId of ['p5', 'p99']) {
      expectRejected(
        state,
        { type: 'WITCH_DECIDE', heal: false, poisonTargetId },
        WerewolfRuleCodes.InvalidTarget,
        'p5',
      );
    }
  });

  it('has nobody to save when the pack attacked nobody', () => {
    const split = apply(
      apply(newGame(CAST), { type: 'WOLF_VOTE', targetId: 'p6' }, 'p1'),
      { type: 'WOLF_VOTE', targetId: 'p7' },
      'p2',
    );
    const state = playUntilWitch(split, { protect: 'p8' });
    expect(view(state)?.attackedId).toBeNull();
    expectRejected(
      state,
      { type: 'WITCH_DECIDE', heal: true, poisonTargetId: null },
      WerewolfRuleCodes.HealNotAvailable,
      'p5',
    );
  });

  it('is left asleep once both potions are spent', () => {
    const day = playNight(newGame(CAST), {
      attack: 'p6',
      protect: 'p7',
      heal: true,
      poison: 'p8',
    });
    const second = playUntilWitch(playDay(day, null), { attack: 'p6', protect: 'p3' });
    expect(second.phase).toBe('DAY_DISCUSSION');
  });

  it('may save herself only when the config allows it', () => {
    const own = playUntilWitch(newGame(CAST), { attack: 'p5', protect: 'p7' });
    expect(legalFor(own, 'p5').canHeal).toBe(true);

    const config = configWith({ rules: { witchCanHealSelf: false } });
    const strict = playUntilWitch(newGame(CAST, { config }), { attack: 'p5', protect: 'p7' });
    expect(legalFor(strict, 'p5').canHeal).toBe(false);
  });
});

describe('the elder', () => {
  const VILLAGE: RoleId[] = ['werewolf', 'elder', 'bodyguard', 'villager', 'villager', 'villager'];

  it('survives the first attack and dies of the second', () => {
    const first = playNight(newGame(VILLAGE), { attack: 'p2', protect: 'p4' });
    expect(lastLog(first)).toEqual({ type: 'NIGHT', round: 1, deaths: [] });
    expect(first.players.p2?.extraLives).toBe(0);

    const second = playNight(playDay(first, null), { attack: 'p2', protect: 'p5' });
    expect(lastLog(second)).toEqual({ type: 'NIGHT', round: 2, deaths: ['p2'] });
  });

  it('keeps the spare life when the bodyguard stops the attack', () => {
    const day = playNight(newGame(VILLAGE), { attack: 'p2', protect: 'p2' });
    expect(day.players.p2?.extraLives).toBe(1);
  });

  it('dies at once when the config gives no spare life', () => {
    const config = configWith({ rules: { elderExtraLives: 0 } });
    const day = playNight(newGame(VILLAGE, { config }), { attack: 'p2', protect: 'p4' });
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: ['p2'] });
  });
});

describe('cupid', () => {
  const VILLAGE: RoleId[] = ['werewolf', 'cupid', 'villager', 'villager', 'villager', 'villager'];

  it('acts alone at the start of the first night', () => {
    const state = newGame(VILLAGE);
    expect(engine.getCurrentPlayerIds(state)).toEqual(['p2']);
    expect(legalFor(state, 'p2')).toMatchObject({
      action: 'CUPID_LINK',
      targets: state.seatOrder,
    });
    expectRejected(state, { type: 'SLEEP' }, WerewolfRuleCodes.NotYourTurn, 'p3');

    const linked = apply(state, { type: 'CUPID_LINK', firstId: 'p3', secondId: 'p4' }, 'p2');
    expect(linked.lovers).toEqual(['p3', 'p4']);
    expect(engine.getCurrentPlayerIds(linked)).toEqual(state.seatOrder);
  });

  it('needs two different players at the table', () => {
    const state = newGame(VILLAGE);
    for (const [firstId, secondId] of [
      ['p3', 'p3'],
      ['p3', 'p99'],
      ['p99', 'p3'],
    ] as const) {
      expectRejected(
        state,
        { type: 'CUPID_LINK', firstId, secondId },
        WerewolfRuleCodes.InvalidTarget,
        'p2',
      );
    }
  });

  it('takes a lover to the grave', () => {
    const day = playNight(newGame(VILLAGE), { couple: ['p3', 'p4'], attack: 'p4' });
    expect(lastLog(day)).toEqual({ type: 'NIGHT', round: 1, deaths: ['p3', 'p4'] });
  });

  it('is not woken again on later nights', () => {
    const second = playDay(
      playNight(newGame(VILLAGE), { couple: ['p3', 'p4'], attack: 'p6' }),
      null,
    );
    expect(second.night?.step).toBe('MAIN');
    expect(legalFor(second, 'p2').action).toBe('SLEEP');
  });
});

describe('the hunter', () => {
  const VILLAGE: RoleId[] = [
    'werewolf',
    'werewolf',
    'hunter',
    'hunter',
    'villager',
    'villager',
    'villager',
  ];

  it('gets a last shot when killed in the night', () => {
    const shot = playNight(newGame(VILLAGE), { attack: 'p3' });
    expect(shot.phase).toBe('HUNTER_SHOT');
    expect(engine.getCurrentPlayerIds(shot)).toEqual(['p3']);
    expect(legalFor(shot, 'p3')).toEqual({
      action: 'HUNTER_SHOOT',
      targets: ['p1', 'p2', 'p4', 'p5', 'p6', 'p7'],
      canSkip: true,
      canHeal: false,
    });

    const day = apply(shot, { type: 'HUNTER_SHOOT', targetId: 'p1' }, 'p3');
    expect(lastLog(day)).toEqual({
      type: 'SHOT',
      round: 1,
      hunterId: 'p3',
      targetId: 'p1',
      deaths: ['p1'],
    });
    expect(day.phase).toBe('DAY_DISCUSSION');
    expect(alive(day)).toEqual(['p2', 'p4', 'p5', 'p6', 'p7']);
  });

  it('may hold fire', () => {
    const shot = playNight(newGame(VILLAGE), { attack: 'p3' });
    const day = apply(shot, { type: 'HUNTER_SHOOT', targetId: null }, 'p3');
    expect(lastLog(day)).toMatchObject({ type: 'SHOT', targetId: null, deaths: [] });
    expect(day.phase).toBe('DAY_DISCUSSION');
  });

  it('is the only one to act, and cannot shoot the dead', () => {
    const shot = playNight(newGame(VILLAGE), { attack: 'p3' });
    expectRejected(
      shot,
      { type: 'HUNTER_SHOOT', targetId: 'p1' },
      WerewolfRuleCodes.NotYourTurn,
      'p4',
    );
    expectRejected(
      shot,
      { type: 'HUNTER_SHOOT', targetId: 'p3' },
      WerewolfRuleCodes.InvalidTarget,
      'p3',
    );
  });

  it('hands the gun on when the shot kills another hunter', () => {
    const first = playNight(newGame(VILLAGE), { attack: 'p3' });
    const second = apply(first, { type: 'HUNTER_SHOOT', targetId: 'p4' }, 'p3');
    expect(second.phase).toBe('HUNTER_SHOT');
    expect(engine.getCurrentPlayerIds(second)).toEqual(['p4']);

    const day = apply(second, { type: 'HUNTER_SHOOT', targetId: 'p1' }, 'p4');
    expect(day.phase).toBe('DAY_DISCUSSION');
    expect(alive(day)).toEqual(['p2', 'p5', 'p6', 'p7']);
  });
});
