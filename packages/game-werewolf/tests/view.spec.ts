import type { GameViewer } from '@bgp/game-core';
import { describe, expect, it } from 'vitest';
import type { RoleId } from '../src/domain/roles.js';
import type { WerewolfState } from '../src/domain/state.js';
import {
  ADMIN,
  SPECTATOR,
  apply,
  asPlayer,
  engine,
  newGame,
  openVote,
  playDay,
  playNight,
  playUntilWitch,
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

const view = (state: WerewolfState, viewer: GameViewer | string) =>
  engine.getPublicView(state, typeof viewer === 'string' ? asPlayer(viewer) : viewer);

/** The roles a viewer is shown, by player. */
function rolesSeen(state: WerewolfState, viewer: GameViewer | string) {
  return Object.fromEntries(
    view(state, viewer).players.map((player) => [player.playerId, player.role]),
  );
}

const NOBODY = Object.fromEntries(CAST.map((_, index) => [`p${index + 1}`, null]));

describe('who knows which roles', () => {
  it('shows a villager their own role and no other', () => {
    const state = newGame(CAST);
    expect(rolesSeen(state, 'p6')).toEqual({ ...NOBODY, p6: 'villager' });
    expect(view(state, 'p6').me).toMatchObject({ playerId: 'p6', role: 'villager', alive: true });
  });

  it('shows the pack to its members alone', () => {
    const state = newGame(CAST);
    expect(rolesSeen(state, 'p1')).toEqual({ ...NOBODY, p1: 'werewolf', p2: 'werewolf' });
    expect(rolesSeen(state, 'p3')).toEqual({ ...NOBODY, p3: 'seer' });
  });

  it('shows no roles to anyone watching', () => {
    const state = newGame(CAST);
    for (const viewer of [SPECTATOR, ADMIN]) {
      expect(rolesSeen(state, viewer)).toEqual(NOBODY);
      expect(view(state, viewer).me).toBeNull();
    }
  });

  it('shows the cast, which is no secret', () => {
    expect(view(newGame(CAST), SPECTATOR).roleCounts).toMatchObject({
      villager: 3,
      werewolf: 2,
      seer: 1,
      cupid: 0,
    });
  });

  it('shows a dead player to all only when the room plays with reveals', () => {
    const shown = playNight(newGame(CAST), { attack: 'p3', protect: 'p4' });
    expect(rolesSeen(shown, SPECTATOR)).toEqual({ ...NOBODY, p3: 'seer' });
    expect(rolesSeen(shown, 'p6')).toEqual({ ...NOBODY, p3: 'seer', p6: 'villager' });

    const hidden = playNight(newGame(CAST, { revealRoleOnDeath: false }), {
      attack: 'p3',
      protect: 'p4',
    });
    expect(rolesSeen(hidden, SPECTATOR)).toEqual(NOBODY);
    // The dead keep to what they knew.
    expect(rolesSeen(hidden, 'p3')).toEqual({ ...NOBODY, p3: 'seer' });
  });

  it('shows everything once the match is over', () => {
    const SMALL: RoleId[] = ['werewolf', 'cupid', 'villager', 'villager', 'villager'];
    const night = playNight(newGame(SMALL, { revealRoleOnDeath: false }), {
      couple: ['p3', 'p4'],
      attack: 'p5',
    });
    const end = playDay(night, 'p1');
    expect(end.phase).toBe('FINISHED');

    const seen = view(end, SPECTATOR);
    expect(seen.players.map((player) => player.role)).toEqual(SMALL);
    expect(seen.lovers).toEqual(['p3', 'p4']);
    expect(seen.winner).toBe('village');
    expect(seen.winnerPlayerIds).toEqual(['p2', 'p3', 'p4', 'p5']);
  });
});

describe('what a night gives away', () => {
  it('is nothing, to those with no part in it', () => {
    const before = newGame(CAST);
    let state = apply(before, { type: 'WOLF_VOTE', targetId: 'p6' }, 'p1');
    state = apply(state, { type: 'SEER_INSPECT', targetId: 'p1' }, 'p3');
    state = apply(state, { type: 'GUARD_PROTECT', targetId: 'p6' }, 'p4');

    for (const viewer of ['p6', 'p7', 'p5', SPECTATOR]) {
      expect(view(state, viewer)).toEqual(view(before, viewer));
    }
  });

  it('does not depend on who the pack chose or the seer saw', () => {
    const night = (attack: string, inspect: string) =>
      playUntilWitch(newGame(CAST), { attack, inspect, protect: 'p8' });
    const one = night('p6', 'p1');
    const other = night('p7', 'p6');

    for (const viewer of ['p4', 'p6', 'p7', 'p8', SPECTATOR]) {
      expect(view(one, viewer)).toEqual(view(other, viewer));
    }
  });

  it('shows a werewolf how the pack has voted', () => {
    const state = apply(newGame(CAST), { type: 'WOLF_VOTE', targetId: 'p6' }, 'p1');
    expect(view(state, 'p2').me?.packVotes).toEqual([{ wolfId: 'p1', targetId: 'p6' }]);
    for (const playerId of ['p3', 'p4', 'p5', 'p6']) {
      expect(view(state, playerId).me?.packVotes).toEqual([]);
    }
  });

  it('keeps what a seer learned to the seer', () => {
    const state = apply(newGame(CAST), { type: 'SEER_INSPECT', targetId: 'p1' }, 'p3');
    expect(view(state, 'p3').me?.inspections).toEqual([{ round: 1, targetId: 'p1', isWolf: true }]);
    for (const playerId of ['p1', 'p4', 'p5', 'p6']) {
      expect(view(state, playerId).me?.inspections).toEqual([]);
    }
  });

  it('shows the victim to the witch alone, and only while she can save them', () => {
    const state = playUntilWitch(newGame(CAST), { attack: 'p6', protect: 'p8' });
    expect(view(state, 'p5').me?.attackedId).toBe('p6');
    for (const playerId of ['p1', 'p3', 'p4', 'p6']) {
      expect(view(state, playerId).me?.attackedId).toBeNull();
    }
    // During the main step, before the pack has settled, she sees nothing either.
    expect(view(newGame(CAST), 'p5').me?.attackedId).toBeNull();
  });

  it('tells a witch her potions and a bodyguard their last watch, and nobody else', () => {
    const state = playNight(newGame(CAST), { attack: 'p6', protect: 'p7', heal: true });
    expect(view(state, 'p5').me?.potions).toEqual({ heal: false, poison: true });
    expect(view(state, 'p4').me?.lastProtectedId).toBe('p7');
    expect(view(state, 'p6').me).toMatchObject({ potions: null, lastProtectedId: null });
  });
});

describe('what a day gives away', () => {
  const morning = () => playNight(newGame(CAST), { attack: 'p8', protect: 'p4' });

  it('shows who is done talking', () => {
    const state = apply(morning(), { type: 'READY_TO_VOTE' }, 'p3');
    expect(view(state, SPECTATOR).ready).toEqual(['p3']);
  });

  it('shows who has voted, never for whom', () => {
    const vote = openVote(morning());
    const one = apply(vote, { type: 'CAST_VOTE', targetId: 'p6' }, 'p1');
    const other = apply(vote, { type: 'CAST_VOTE', targetId: null }, 'p1');

    expect(view(one, 'p2').voted).toEqual(['p1']);
    for (const viewer of ['p1', 'p2', 'p6', SPECTATOR]) {
      expect(view(one, viewer)).toEqual(view(other, viewer));
    }
  });

  it('shows every vote once all are in', () => {
    const night = playDay(morning(), 'p1');
    expect(view(night, SPECTATOR).log.at(-1)).toMatchObject({
      type: 'VOTE',
      executedId: 'p1',
      votes: expect.arrayContaining([{ voterId: 'p2', targetId: 'p1' }]),
    });
    expect(view(night, SPECTATOR).voted).toEqual([]);
  });

  it('names the hunter everyone is waiting on', () => {
    const HUNT: RoleId[] = ['werewolf', 'hunter', 'villager', 'villager', 'villager'];
    const shot = playNight(newGame(HUNT), { attack: 'p2' });
    expect(view(shot, SPECTATOR).shooterId).toBe('p2');
    expect(view(newGame(HUNT), SPECTATOR).shooterId).toBeNull();
  });
});

describe('the couple', () => {
  const VILLAGE: RoleId[] = ['werewolf', 'cupid', 'villager', 'villager', 'villager', 'villager'];

  it('is known to the lovers and to cupid alone', () => {
    const state = apply(
      newGame(VILLAGE),
      { type: 'CUPID_LINK', firstId: 'p3', secondId: 'p4' },
      'p2',
    );
    for (const playerId of ['p2', 'p3', 'p4']) {
      expect(view(state, playerId).lovers).toEqual(['p3', 'p4']);
    }
    for (const viewer of ['p1', 'p5', SPECTATOR, ADMIN]) {
      expect(view(state, viewer).lovers).toBeNull();
    }
    // Knowing each other is not knowing each other's role.
    expect(rolesSeen(state, 'p3').p4).toBeNull();
  });
});

describe('the view', () => {
  it('is a copy: changing it leaves the match alone', () => {
    const state = playNight(newGame(CAST), { attack: 'p6', protect: 'p7' });
    const seen = view(state, 'p3');
    seen.log.length = 0;
    seen.players.length = 0;
    seen.roleCounts.werewolf = 9;
    seen.me?.legal.targets.push('p99');

    expect(view(state, 'p3')).toEqual(engine.getPublicView(state, asPlayer('p3')));
    expect(state.log).toHaveLength(1);
    expect(state.setup.roleCounts.werewolf).toBe(2);
  });
});
