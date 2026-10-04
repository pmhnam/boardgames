import { BOT_LEVELS, createSeededRandom, type BotLevel } from '@bgp/game-core';
import { playBotMatch } from '@bgp/game-core/testing';
import { describe, expect, it } from 'vitest';
import type { WerewolfAction } from '../src/domain/actions.js';
import type { RoleId } from '../src/domain/roles.js';
import type { WerewolfState } from '../src/domain/state.js';
import { WerewolfBot } from '../src/index.js';
import {
  apply,
  asPlayer,
  customSettings,
  engine,
  newGame,
  openVote,
  playDay,
  playNight,
  playUntilWitch,
} from './fixtures/states.js';

function choose(
  state: WerewolfState,
  playerId: string,
  level: BotLevel,
  seed = 'r',
): WerewolfAction {
  return WerewolfBot.chooseAction({
    view: engine.getPublicView(state, asPlayer(playerId)),
    playerId,
    level,
    random: createSeededRandom(seed),
  });
}

const seeds = (count: number) => Array.from({ length: count }, (_, index) => `seed-${index}`);

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

describe('Werewolf bot', () => {
  // playBotMatch throws on any illegal action, so finishing is the assertion. The ceiling is
  // far below the default: a table that never agrees on anyone would hit it.
  it.each([
    [5, 'easy'],
    [5, 'hard'],
    [8, 'easy'],
    [8, 'normal'],
    [11, 'normal'],
    [12, 'hard'],
    [16, 'easy'],
    [16, 'normal'],
    [16, 'hard'],
  ] as Array<[number, BotLevel]>)('plays a table of %i to the end at %s', (players, level) => {
    for (const seed of seeds(4)) {
      const { state } = playBotMatch(engine, WerewolfBot, {
        seed,
        levels: Array.from({ length: players }, () => level),
        maxActions: 3000,
      });
      expect(state.phase).toBe('FINISHED');
    }
  });

  it('plays a mixed table, on a cast with every role in it', () => {
    const settings = customSettings({
      werewolf: 2,
      alphaWerewolf: 1,
      seer: 1,
      bodyguard: 1,
      witch: 1,
      hunter: 2,
      cupid: 1,
      elder: 1,
      idiot: 1,
    });
    for (const seed of seeds(6)) {
      const { state } = playBotMatch(engine, WerewolfBot, {
        seed,
        levels: Array.from({ length: 13 }, (_, index) => BOT_LEVELS[index % 3] as BotLevel),
        settings,
        maxActions: 3000,
      });
      expect(state.phase).toBe('FINISHED');
    }
  });

  it.each(BOT_LEVELS)('follows the pack when a packmate has chosen (%s)', (level) => {
    const state = apply(newGame(CAST), { type: 'WOLF_VOTE', targetId: 'p7' }, 'p1');
    for (const seed of seeds(5)) {
      expect(choose(state, 'p2', level, seed)).toEqual({ type: 'WOLF_VOTE', targetId: 'p7' });
    }
  });

  it('does not vote against the pack, or shoot at it', () => {
    const vote = openVote(playNight(newGame(CAST), { attack: 'p8', protect: 'p4' }));
    for (const level of ['normal', 'hard'] as const) {
      for (const seed of seeds(20)) {
        expect(choose(vote, 'p1', level, seed)).not.toMatchObject({ targetId: 'p2' });
      }
    }
  });

  it('does not turn on its lover', () => {
    const VILLAGE: RoleId[] = ['werewolf', 'cupid', 'villager', 'villager', 'villager', 'villager'];
    const night = playNight(newGame(VILLAGE), { couple: ['p1', 'p3'], attack: 'p6' });
    const second = playDay(night, null);
    const vote = openVote(night);
    for (const seed of seeds(20)) {
      expect(choose(second, 'p1', 'normal', seed)).not.toMatchObject({ targetId: 'p3' });
      expect(choose(vote, 'p3', 'normal', seed)).not.toMatchObject({ targetId: 'p1' });
    }
  });

  it('votes for a werewolf its seer has found', () => {
    const vote = openVote(playNight(newGame(CAST), { attack: 'p8', protect: 'p4', inspect: 'p2' }));
    for (const level of ['normal', 'hard'] as const) {
      expect(choose(vote, 'p3', level)).toEqual({ type: 'CAST_VOTE', targetId: 'p2' });
    }
  });

  it('looks at someone new each night as a seer', () => {
    const second = playDay(
      playNight(newGame(CAST), { attack: 'p8', protect: 'p4', inspect: 'p6' }),
      null,
    );
    for (const seed of seeds(20)) {
      expect(choose(second, 'p3', 'normal', seed)).not.toMatchObject({ targetId: 'p6' });
    }
  });

  it('saves the victim as a witch, and keeps the poison until it has a suspect', () => {
    const state = playUntilWitch(newGame(CAST), { attack: 'p6', protect: 'p8' });
    for (const level of ['normal', 'hard'] as const) {
      expect(choose(state, 'p5', level)).toEqual({
        type: 'WITCH_DECIDE',
        heal: true,
        poisonTargetId: null,
      });
    }
  });

  it('poisons, at its hardest, whoever the village nearly executed', () => {
    const morning = playNight(newGame(CAST), { attack: 'p8', protect: 'p4' });
    // Three votes each for p1 and p7: a tie, so both live to see the night.
    const night = playDay(morning, 'p1', { p1: 'p7', p2: 'p7', p3: 'p7', p7: null });
    const state = playUntilWitch(night, { attack: 'p6', protect: 'p3' });
    expect(choose(state, 'p5', 'hard')).toMatchObject({ poisonTargetId: 'p1' });
    expect(choose(state, 'p5', 'normal')).toMatchObject({ poisonTargetId: null });
  });

  it('refuses a seat with nothing to do', () => {
    const state = apply(newGame(CAST), { type: 'SLEEP' }, 'p6');
    expect(() => choose(state, 'p6', 'easy')).toThrowError();
  });
});
