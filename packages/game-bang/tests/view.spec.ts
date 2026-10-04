import { describe, expect, it } from 'vitest';
import type { BangState } from '../src/domain/state.js';
import {
  SPECTATOR,
  apply,
  endTurn,
  engine,
  legalFor,
  newGame,
  play,
  player,
  respond,
  table,
  viewFor,
} from './fixtures/states.js';

/** The ids of the cards a viewer has no business knowing: the deck's and other hands'. */
function hiddenFrom(state: BangState, viewerId: string | null): string[] {
  return [
    ...state.deck,
    ...state.seatOrder
      .filter((playerId) => playerId !== viewerId)
      .flatMap((playerId) => player(state, playerId).hand),
  ];
}

/**
 * Nothing but the log may name a hidden card. The log may: a card the table saw played or
 * discarded can since have been shuffled back into the deck, or picked up by someone.
 */
function expectNoLeak(state: BangState, viewerId: string | null): void {
  const view =
    viewerId === null ? engine.getPublicView(state, SPECTATOR) : viewFor(state, viewerId);
  const text = JSON.stringify({ ...view, log: [] });
  for (const cardId of hiddenFrom(state, viewerId)) {
    expect(text).not.toContain(`"${cardId}"`);
  }
}

describe('roles', () => {
  const state = table([
    {},
    { role: 'renegade' },
    { role: 'outlaw' },
    { role: 'deputy', alive: false },
  ]);
  const roles = (viewerId: string | null) =>
    (viewerId === null
      ? engine.getPublicView(state, SPECTATOR)
      : viewFor(state, viewerId)
    ).players.map((seat) => seat.role);

  it("are hidden, but for the sheriff, the eliminated and one's own", () => {
    expect(roles('p1')).toEqual(['sheriff', null, null, 'deputy']);
    expect(roles('p2')).toEqual(['sheriff', 'renegade', null, 'deputy']);
    expect(roles('p3')).toEqual(['sheriff', null, 'outlaw', 'deputy']);
    expect(roles(null)).toEqual(['sheriff', null, null, 'deputy']);
    expect(engine.getPublicView(state, { type: 'admin' }).players.map((seat) => seat.role)).toEqual(
      roles(null),
    );
  });

  it('are counted out for everyone', () => {
    expect(viewFor(state, 'p3').roleCounts).toEqual({
      sheriff: 1,
      deputy: 1,
      outlaw: 1,
      renegade: 1,
    });
    expect(viewFor(state, 'p2').me?.role).toBe('renegade');
  });
});

describe('cards', () => {
  const state = table(
    [
      { hand: ['bang', 'beer'], inPlay: ['barrel'] },
      { hand: ['missed', 'duel', 'gatling'] },
      {},
      {},
    ],
    { discard: ['saloon', 'stagecoach'] },
  );

  it('in a hand are shown to its holder and counted for everyone else', () => {
    const mine = viewFor(state, 'p1');
    expect(mine.me?.hand.map((card) => card.kind)).toEqual(['bang', 'beer']);
    expect(mine.players.map((seat) => seat.handCount)).toEqual([2, 3, 0, 0]);
    expect(mine.players[0]?.inPlay.map((card) => card.kind)).toEqual(['barrel']);
    expect(engine.getPublicView(state, SPECTATOR).me).toBeNull();
  });

  it('in the piles are a count, and the top of the discard pile', () => {
    const view = viewFor(state, 'p3');
    expect(view.deckCount).toBe(state.deck.length);
    expect(view.discardCount).toBe(2);
    expect(view.discardTop?.kind).toBe('stagecoach');
  });

  it('never leave the server for anyone who should not see them', () => {
    for (const viewerId of ['p1', 'p2', 'p3', null]) expectNoLeak(state, viewerId);
  });

  it('stay hidden through a whole match', () => {
    let state = newGame(5, 'leaks');
    for (let step = 0; step < 300 && engine.getGameStatus(state) === 'playing'; step += 1) {
      for (const viewerId of [...state.seatOrder, null]) expectNoLeak(state, viewerId);
      const [playerId] = engine.getCurrentPlayerIds(state);
      if (playerId === undefined) break;
      const legal = legalFor(state, playerId);
      const option = legal.plays[0];
      if (legal.prompt === 'PLAY' && option && step % 3 !== 0) {
        const targetId = option.targets?.[0] ?? null;
        const target = targetId ? player(state, targetId) : null;
        const kind = state.cards[option.cardId]?.kind;
        const takes = kind === 'panic' || kind === 'catBalou';
        state = apply(
          state,
          {
            type: 'PLAY_CARD',
            cardId: option.cardId,
            targetId,
            targetCardId: takes && target?.hand.length === 0 ? (target.inPlay[0] ?? null) : null,
          },
          playerId,
        );
      } else if (legal.prompt === 'PLAY') {
        state = endTurn(state, playerId);
      } else if (legal.pickCount > 0) {
        state = apply(
          state,
          { type: 'PICK_CARDS', cardIds: legal.picks.slice(0, legal.pickCount) },
          playerId,
        );
      } else if (legal.prompt === 'DRAW') {
        const targetId = legal.drawFromPlayers[0] ?? null;
        state = apply(
          state,
          { type: 'DRAW', source: targetId ? 'player' : 'deck', targetId },
          playerId,
        );
      } else {
        state = apply(state, { type: 'RESPOND', cardId: legal.responses[0] ?? null }, playerId);
      }
    }
  });
});

describe('a card changing hands', () => {
  const state = play(table([{ hand: ['panic'] }, { hand: ['beer'] }, {}, {}]), 'p1', 'panic', 'p2');
  const taken = (viewerId: string | null) => {
    const view =
      viewerId === null ? engine.getPublicView(state, SPECTATOR) : viewFor(state, viewerId);
    const entry = view.log.at(-1);
    return entry?.type === 'TAKE' ? entry.card : undefined;
  };

  it('is known to the two players involved', () => {
    expect(taken('p1')).toMatchObject({ kind: 'beer' });
    expect(taken('p2')).toMatchObject({ kind: 'beer' });
  });

  it('is not known to anyone else', () => {
    expect(taken('p3')).toBeNull();
    expect(taken(null)).toBeNull();
    expect(JSON.stringify(viewFor(state, 'p3'))).not.toContain(`"${player(state, 'p1').hand[0]}"`);
  });

  it('is known to all when it is discarded, or came off the table', () => {
    const balou = play(
      table([{ hand: ['catBalou'] }, { hand: ['beer'] }, {}, {}]),
      'p1',
      'catBalou',
      'p2',
    );
    expect(viewFor(balou, 'p3').log.at(-1)).toMatchObject({ type: 'TAKE', card: { kind: 'beer' } });

    const scope = play(
      table([{ hand: ['panic'] }, { inPlay: ['scope'] }, {}, {}]),
      'p1',
      'panic',
      'p2',
      'scope',
    );
    expect(viewFor(scope, 'p3').log.at(-1)).toMatchObject({
      type: 'TAKE',
      card: { kind: 'scope' },
    });
  });
});

describe('what a player may do', () => {
  const state = table([{ hand: ['bang', 'beer'] }, { hand: ['missed'] }, {}, {}]);

  it('is listed for the player the match is waiting on, and for nobody else', () => {
    expect(legalFor(state, 'p1')).toMatchObject({ prompt: 'PLAY', discardCount: 0 });
    expect(legalFor(state, 'p1').plays).toEqual([
      { cardId: player(state, 'p1').hand[0], targets: ['p2', 'p4'] },
    ]);
    expect(legalFor(state, 'p2')).toMatchObject({ prompt: null, plays: [], canPass: false });
    expect(viewFor(state, 'p3').pending).toBeNull();
  });

  it('follows the match to whoever has to answer', () => {
    const shot = play(state, 'p1', 'bang', 'p2');
    expect(legalFor(shot, 'p1').prompt).toBeNull();
    expect(legalFor(shot, 'p2').prompt).toBe('BANG');
    const done = respond(shot, 'p2', 'missed');
    expect(legalFor(done, 'p1').prompt).toBe('PLAY');
  });

  it('is nothing at all once the match is over, or for the eliminated', () => {
    const dead = table([{}, { alive: false }, {}, {}]);
    expect(legalFor(dead, 'p2').prompt).toBeNull();
    const over = { ...state, phase: 'FINISHED' as const };
    expect(legalFor(over, 'p1').prompt).toBeNull();
  });
});

describe('the view', () => {
  it('shares nothing with the state it was built from', () => {
    const state = table([{ hand: ['bang'], inPlay: ['barrel'] }, {}, {}, {}]);
    const view = viewFor(state, 'p1');
    view.players[0]?.inPlay.pop();
    view.me?.hand.pop();
    view.me?.legal.plays.pop();
    view.log.pop();
    expect(viewFor(state, 'p1')).toEqual(viewFor(state, 'p1'));
    expect(viewFor(state, 'p1').me?.hand).toHaveLength(1);
  });
});
