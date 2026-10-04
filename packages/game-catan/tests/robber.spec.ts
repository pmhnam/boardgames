import { describe, expect, it } from 'vitest';
import { CatanRuleCodes } from '../src/domain/errors.js';
import { countResources } from '../src/domain/resources.js';
import { getDiscardOwed } from '../src/rules/robber.rules.js';
import {
  active,
  apply,
  build,
  cards,
  corner,
  countAll,
  engine,
  expectRejected,
  hold,
  inMain,
  others,
  player,
  rigDice,
  started,
  withTurn,
} from './fixtures/states.js';

function rollSeven(state: ReturnType<typeof started>) {
  return apply(rigDice(state, 7), { type: 'ROLL_DICE' });
}

describe('discarding to a 7', () => {
  it('asks for half of a hand of more than seven, rounded down', () => {
    expect(getDiscardOwed(7, 7)).toBe(0);
    expect(getDiscardOwed(8, 7)).toBe(4);
    expect(getDiscardOwed(9, 7)).toBe(4);
    expect(getDiscardOwed(15, 7)).toBe(7);
  });

  it('goes straight to the robber when nobody holds too much', () => {
    const state = hold(started(), active(started()), { wood: 7 });
    const next = rollSeven(state);
    expect(next.turn).toMatchObject({ step: 'ROBBER', pendingDiscards: {} });
    expect(engine.getCurrentPlayerIds(next)).toEqual([active(state)]);
  });

  it('waits for everyone who holds too much, whoever rolled', () => {
    const base = started();
    const [second, third] = others(base);
    const state = hold(hold(base, second as string, { wood: 8 }), third as string, { ore: 9 });

    const next = rollSeven(state);

    expect(next.turn.step).toBe('DISCARD');
    expect(next.turn.pendingDiscards).toEqual({ [second as string]: 4, [third as string]: 4 });
    expect(engine.getCurrentPlayerIds(next)).toEqual([second, third]);
  });

  it('lets them discard in any order, then turns to the robber', () => {
    const base = started();
    const me = active(base);
    const [second, third] = others(base) as [string, string];
    const state = rollSeven(
      hold(hold(hold(base, me, { grain: 10 }), second, { wood: 8 }), third, { ore: 9 }),
    );

    const afterThird = apply(state, { type: 'DISCARD', resources: { ore: 4 } }, third);
    expect(player(afterThird, third).resources).toEqual(cards({ ore: 5 }));
    expect(afterThird.supply.ore).toBe(state.supply.ore + 4);
    expect(engine.getCurrentPlayerIds(afterThird)).toEqual([me, second]);

    const afterMe = apply(afterThird, { type: 'DISCARD', resources: { grain: 5 } }, me);
    expect(afterMe.turn.step).toBe('DISCARD');

    const done = apply(afterMe, { type: 'DISCARD', resources: { wood: 4 } }, second);
    expect(done.turn).toMatchObject({ step: 'ROBBER', pendingDiscards: {} });
    expect(engine.getCurrentPlayerIds(done)).toEqual([me]);
    expect(countAll(done)).toEqual(countAll(base));
  });

  it('refuses the wrong number of cards, or cards not held', () => {
    const base = started();
    const victim = others(base)[0] as string;
    const state = rollSeven(hold(base, victim, { wood: 6, brick: 2 }));

    expectRejected(
      state,
      { type: 'DISCARD', resources: { wood: 3 } },
      CatanRuleCodes.InvalidDiscard,
      victim,
    );
    expectRejected(
      state,
      { type: 'DISCARD', resources: { wood: 5 } },
      CatanRuleCodes.InvalidDiscard,
      victim,
    );
    expectRejected(
      state,
      { type: 'DISCARD', resources: { brick: 3, wood: 1 } },
      CatanRuleCodes.InvalidDiscard,
      victim,
    );
  });

  it('refuses a player who owes nothing, or has already discarded', () => {
    const base = started();
    const [second, third] = others(base) as [string, string];
    const state = rollSeven(hold(hold(base, second, { wood: 8 }), third, { ore: 8 }));

    expectRejected(
      state,
      { type: 'DISCARD', resources: { wood: 1 } },
      CatanRuleCodes.NothingToDiscard,
      active(base),
    );
    const next = apply(state, { type: 'DISCARD', resources: { wood: 4 } }, second);
    expectRejected(
      next,
      { type: 'DISCARD', resources: { wood: 2 } },
      CatanRuleCodes.NothingToDiscard,
      second,
    );
    expectRejected(inMain(), { type: 'DISCARD', resources: {} }, CatanRuleCodes.NothingToDiscard);
  });

  it('keeps the robber where it is until everyone has discarded', () => {
    const base = started();
    const state = rollSeven(hold(base, others(base)[0] as string, { wood: 8 }));
    expectRejected(state, { type: 'MOVE_ROBBER', hex: '1,0' }, CatanRuleCodes.WrongStep);
    expectRejected(state, { type: 'END_TURN' }, CatanRuleCodes.WrongStep);
  });
});

describe('moving the robber', () => {
  const robbing = () => withTurn(started(), { step: 'ROBBER', roll: [3, 4] });

  it('moves to another hex and lets the turn go on', () => {
    const state = robbing();
    const next = apply(state, { type: 'MOVE_ROBBER', hex: '1,0' });
    expect(next.robber).toBe('1,0');
    expect(next.turn.step).toBe('MAIN');
  });

  it('must leave the hex it is on, for a hex of the board', () => {
    const state = robbing();
    expectRejected(
      state,
      { type: 'MOVE_ROBBER', hex: state.robber },
      CatanRuleCodes.RobberMustMove,
    );
    expectRejected(state, { type: 'MOVE_ROBBER', hex: '7,7' }, CatanRuleCodes.InvalidHex);
  });

  it('is refused outside the robber step', () => {
    expectRejected(inMain(), { type: 'MOVE_ROBBER', hex: '1,0' }, CatanRuleCodes.WrongStep);
  });

  it('takes one card at random from the player chosen', () => {
    const base = robbing();
    const me = active(base);
    const victim = others(base)[0] as string;
    const state = hold(build(base, victim, corner(1, 0, 0)), victim, { wool: 2, ore: 1 });

    const next = apply(state, { type: 'MOVE_ROBBER', hex: '1,0', victimId: victim });

    expect(countResources(player(next, me).resources)).toBe(1);
    expect(countResources(player(next, victim).resources)).toBe(2);
    expect(next.supply).toEqual(state.supply);
    expect(countAll(next)).toEqual(countAll(state));
    expect(next.random.draws).toBe(state.random.draws + 1);
  });

  it('draws the same card again from the same state, and other cards from other draws', () => {
    const base = robbing();
    const victim = others(base)[0] as string;
    const state = hold(build(base, victim, corner(1, 0, 0)), victim, { wool: 3, ore: 3 });
    const action = { type: 'MOVE_ROBBER', hex: '1,0', victimId: victim } as const;

    expect(apply(state, action)).toEqual(apply(state, action));
    const stolen = new Set<string>();
    for (let draws = 0; draws < 20; draws += 1) {
      const next = apply({ ...state, random: { ...state.random, draws } }, action);
      stolen.add(player(next, active(base)).resources.wool === 1 ? 'wool' : 'ore');
    }
    expect([...stolen].sort()).toEqual(['ore', 'wool']);
  });

  it('must rob somebody when a player with cards is on the hex', () => {
    const base = robbing();
    const [second, third] = others(base) as [string, string];
    const state = hold(build(base, second, corner(1, 0, 0)), second, { wool: 1 });

    expectRejected(state, { type: 'MOVE_ROBBER', hex: '1,0' }, CatanRuleCodes.InvalidVictim);
    expectRejected(
      state,
      { type: 'MOVE_ROBBER', hex: '1,0', victimId: third },
      CatanRuleCodes.InvalidVictim,
    );
    expectRejected(
      state,
      { type: 'MOVE_ROBBER', hex: '1,0', victimId: active(base) },
      CatanRuleCodes.InvalidVictim,
    );
  });

  it('robs nobody on a hex where nobody else has cards', () => {
    const base = robbing();
    const me = active(base);
    const second = others(base)[0] as string;
    // A neighbour with an empty hand, and the robbing player's own building.
    const state = hold(build(build(base, second, corner(1, 0, 0)), me, corner(1, 0, 3)), me, {
      wool: 2,
    });

    expectRejected(
      state,
      { type: 'MOVE_ROBBER', hex: '1,0', victimId: second },
      CatanRuleCodes.InvalidVictim,
    );
    const next = apply(state, { type: 'MOVE_ROBBER', hex: '1,0' });
    expect(player(next, me).resources).toEqual(cards({ wool: 2 }));
    expect(next.random.draws).toBe(state.random.draws);
  });

  it('offers a choice when several players are on the hex', () => {
    const base = robbing();
    const [second, third] = others(base) as [string, string];
    const state = hold(
      hold(build(build(base, second, corner(1, 0, 0)), third, corner(1, 0, 3)), second, { ore: 1 }),
      third,
      { ore: 1 },
    );
    const view = engine.getPublicView(state, { type: 'player', playerId: active(base) });
    expect(view.legal.robberTargets['1,0']).toEqual([second, third].sort());
    expect(view.legal.robberTargets['2,0']).toEqual([]);
    expect(view.legal.robberTargets[state.robber]).toBeUndefined();
  });
});
