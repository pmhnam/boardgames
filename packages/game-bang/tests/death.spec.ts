import { describe, expect, it } from 'vitest';
import {
  SPECTATOR,
  configWith,
  endTurn,
  engine,
  handOf,
  kinds,
  play,
  player,
  respond,
  table,
  viewFor,
  type SeatSpec,
} from './fixtures/states.js';

/** p1 the sheriff shoots p2, who is on their last life point. */
function shoot(victim: SeatSpec, rest: SeatSpec[] = [{}, {}], sheriff: SeatSpec = {}) {
  const state = table([{ hand: ['bang'], ...sheriff }, { life: 1, ...victim }, ...rest]);
  return play(state, 'p1', 'bang', 'p2');
}

describe('elimination', () => {
  it('takes a player at zero life out of the match and shows their role', () => {
    const state = respond(
      shoot({ role: 'renegade', hand: ['duel'], inPlay: ['scope'] }),
      'p2',
      null,
    );
    const dead = player(state, 'p2');
    expect(dead).toMatchObject({ alive: false, life: 0, hand: [], inPlay: [] });
    // What they held goes to the discard pile.
    expect(kinds(state, state.discard)).toEqual(['bang', 'duel', 'scope']);
    expect(viewFor(state, 'p3').players[1]).toMatchObject({ alive: false, role: 'renegade' });
    expect(engine.getPublicView(state, SPECTATOR).players[1]?.role).toBe('renegade');
    expect(state.log.at(-1)).toMatchObject({
      type: 'DEATH',
      playerId: 'p2',
      role: 'renegade',
      killerId: 'p1',
    });
    expect(engine.getGameStatus(state)).toBe('playing');
  });

  it('is put off by a beer in hand, drunk without asking', () => {
    const shot = shoot({ hand: ['beer', 'duel'] });
    const saved = respond(shot, 'p2', null);
    expect(player(saved, 'p2')).toMatchObject({ alive: true, life: 1 });
    expect(handOf(saved, 'p2')).toEqual(['duel']);
    expect(kinds(saved, saved.discard)).toEqual(['bang', 'beer']);
  });

  it('is not put off by a beer once only two are left', () => {
    const shot = shoot({ role: 'renegade', hand: ['beer'] }, [{ alive: false }, { alive: false }]);
    const dead = respond(shot, 'p2', null);
    expect(player(dead, 'p2').alive).toBe(false);
    expect(engine.getGameStatus(dead)).toBe('finished');
  });

  it('needs a beer for every life point below one', () => {
    const lit = (hand: SeatSpec['hand']) =>
      endTurn(
        table([{}, { life: 2, hand, inPlay: ['dynamite'] }, {}, {}], {
          deckTop: [{ suit: 'spades', rank: 4 }],
        }),
        'p1',
      );
    // Two life points from three damage: one beer short, so neither is drunk.
    const lost = lit(['beer']);
    expect(player(lost, 'p2').alive).toBe(false);
    expect(kinds(lost, lost.discard)).toEqual(expect.arrayContaining(['dynamite', 'beer']));

    const saved = lit(['beer', 'beer', 'beer']);
    expect(player(saved, 'p2')).toMatchObject({ alive: true, life: 1 });
    expect(handOf(saved, 'p2').filter((kind) => kind === 'beer')).toHaveLength(1);
  });
});

describe('what a killing earns', () => {
  it('three cards for an outlaw', () => {
    const state = shoot({ role: 'outlaw' });
    expect(player(state, 'p1').hand).toHaveLength(3);
    expect(state.log.at(-1)).toMatchObject({ type: 'DRAW', playerId: 'p1', count: 3 });
  });

  it('as many as the config says', () => {
    const config = configWith({ rules: { outlawBounty: 1 } });
    const state = table([{ hand: ['bang'] }, { role: 'outlaw', life: 1 }, {}, {}], { config });
    expect(player(play(state, 'p1', 'bang', 'p2'), 'p1').hand).toHaveLength(1);
  });

  it('nothing for anyone else', () => {
    expect(player(shoot({ role: 'renegade' }), 'p1').hand).toHaveLength(0);
  });

  it('nothing for a dynamite', () => {
    const state = endTurn(
      table([{}, { role: 'outlaw', life: 1, inPlay: ['dynamite'] }, {}, {}], {
        deckTop: [{ suit: 'spades', rank: 4 }],
      }),
      'p1',
    );
    expect(player(state, 'p2').alive).toBe(false);
    expect(player(state, 'p1').hand).toHaveLength(0);
  });

  it('the loss of every card for a sheriff who kills a deputy', () => {
    const state = shoot({ role: 'deputy' }, [{}, {}], {
      hand: ['bang', 'beer', 'missed'],
      inPlay: ['schofield', 'barrel'],
    });
    expect(player(state, 'p1')).toMatchObject({ hand: [], inPlay: [], alive: true });
    expect(state.log.at(-1)).toMatchObject({ type: 'DISCARD', playerId: 'p1', reason: 'penalty' });
  });

  it('but not for anyone else who kills a deputy', () => {
    const state = table(
      [{}, { role: 'outlaw', hand: ['bang', 'beer'] }, { role: 'deputy', life: 1 }, {}],
      { turn: 'p2' },
    );
    expect(handOf(play(state, 'p2', 'bang', 'p3'), 'p2')).toEqual(['beer']);
  });
});

describe('the end of the match', () => {
  it('the outlaws win when the sheriff dies, the dead ones too', () => {
    const state = table(
      [
        { life: 1 },
        { role: 'renegade', hand: ['bang'] },
        { role: 'outlaw', alive: false },
        { role: 'outlaw' },
        { role: 'deputy' },
      ],
      { turn: 'p2' },
    );
    const over = play(state, 'p2', 'bang', 'p1');
    expect(over).toMatchObject({ phase: 'FINISHED', winner: 'outlaws', pending: [] });
    expect(over.winnerPlayerIds).toEqual(['p3', 'p4']);
    expect(engine.getGameStatus(over)).toBe('finished');
    expect(engine.getResult(over)).toEqual({ winnerPlayerIds: ['p3', 'p4'] });
    expect(engine.getCurrentPlayerIds(over)).toEqual([]);
  });

  it('the renegade wins by being the last one standing', () => {
    const state = table(
      [{ life: 1 }, { role: 'renegade', hand: ['bang'] }, { alive: false }, { alive: false }],
      { turn: 'p2' },
    );
    const over = play(state, 'p2', 'bang', 'p1');
    expect(over).toMatchObject({ phase: 'FINISHED', winner: 'renegade' });
    expect(over.winnerPlayerIds).toEqual(['p2']);
  });

  it('the law wins when the last outlaw and renegade are gone, dead deputies too', () => {
    const state = table([
      { hand: ['bang'] },
      { role: 'outlaw', life: 1 },
      { role: 'renegade', alive: false },
      { role: 'deputy', alive: false },
      { role: 'deputy' },
    ]);
    const over = play(state, 'p1', 'bang', 'p2');
    expect(over).toMatchObject({ phase: 'FINISHED', winner: 'law' });
    expect(over.winnerPlayerIds).toEqual(['p1', 'p4', 'p5']);
    // Nobody collects on the last outlaw.
    expect(player(over, 'p1').hand).toHaveLength(0);
  });

  it('is not reached while a renegade is still up against the sheriff', () => {
    const state = shoot({ role: 'outlaw' }, [{ role: 'renegade' }, { role: 'deputy' }]);
    expect(state.phase).toBe('PLAYING');
    expect(engine.getResult(state)).toBeNull();
  });

  it('shows everyone every role', () => {
    const over = shoot({ role: 'outlaw' }, [
      { role: 'deputy' },
      { role: 'renegade', alive: false },
    ]);
    expect(over.phase).toBe('FINISHED');
    expect(viewFor(over, 'p2').players.map((seat) => seat.role)).toEqual([
      'sheriff',
      'outlaw',
      'deputy',
      'renegade',
    ]);
  });
});

describe('dying in the middle of things', () => {
  it('on your own turn, in a duel you started, ends the turn', () => {
    const state = table([{}, { life: 1, hand: ['duel'] }, { hand: ['bang'] }, {}, {}], {
      turn: 'p2',
    });
    const lost = respond(play(state, 'p2', 'duel', 'p3'), 'p3', 'bang');
    expect(player(lost, 'p2').alive).toBe(false);
    expect(lost.log.find((entry) => entry.type === 'DEATH')).toMatchObject({ killerId: 'p3' });
    expect(lost.turn).toMatchObject({ playerId: 'p3', step: 'PLAY' });
    expect(player(lost, 'p3').hand).toHaveLength(2);
  });

  it('a Gatling goes on past the players it kills', () => {
    const state = table([
      { hand: ['gatling'] },
      { role: 'outlaw', life: 1, hand: ['duel'] },
      { role: 'outlaw', hand: ['missed'] },
      { role: 'renegade' },
    ]);
    const fired = respond(play(state, 'p1', 'gatling'), 'p2', null);
    expect(player(fired, 'p2').alive).toBe(false);
    expect(engine.getCurrentPlayerIds(fired)).toEqual(['p3']);
    const done = respond(fired, 'p3', 'missed');
    expect(player(done, 'p4').life).toBe(3);
    // The bounty for p2, on top of p2's own card going to the discard pile.
    expect(player(done, 'p1').hand).toHaveLength(3);
  });

  it('a Gatling stops dead when it ends the match', () => {
    const state = table(
      [{ life: 1 }, { role: 'outlaw', hand: ['gatling'] }, { hand: ['missed'] }, { alive: false }],
      { turn: 'p2' },
    );
    const fired = respond(play(state, 'p2', 'gatling'), 'p3', 'missed');
    expect(fired).toMatchObject({ phase: 'FINISHED', winner: 'outlaws', pending: [] });
  });
});
