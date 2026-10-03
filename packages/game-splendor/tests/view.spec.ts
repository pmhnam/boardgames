import type { GameViewer } from '@bgp/game-core';
import { describe, expect, it } from 'vitest';
import { NO_LEGAL_MOVES } from '../src/rules/legal-moves.js';
import { active, apply, cards, engine, newGame, other } from './fixtures/states.js';

const SPECTATOR: GameViewer = { type: 'spectator' };
const ADMIN: GameViewer = { type: 'admin' };
const asPlayer = (playerId: string): GameViewer => ({ type: 'player', playerId });

describe('public view', () => {
  it('shows the decks as counts only', () => {
    const state = newGame();
    for (const viewer of [asPlayer(active(state)), asPlayer(other(state)), SPECTATOR, ADMIN]) {
      const view = engine.getPublicView(state, viewer);
      expect(view).not.toHaveProperty('decks');
      expect(view).not.toHaveProperty('config');
      expect(view.deckCounts).toEqual({ 1: 36, 2: 26, 3: 16 });

      const text = JSON.stringify(view);
      for (const tier of [1, 2, 3] as const) {
        for (const cardId of state.decks[tier]) expect(text).not.toContain(`"${cardId}"`);
      }
    }
  });

  it('shows face-up cards and nobles in full', () => {
    const state = newGame();
    const view = engine.getPublicView(state, SPECTATOR);
    expect(view.market[1].map((card) => card?.id)).toEqual(state.market[1]);
    expect(view.market[3][0]).toEqual(cards.find((card) => card.id === state.market[3][0]));
    expect(view.nobles.map((noble) => noble.id)).toEqual(state.nobles);
    expect(view.targetScore).toBe(15);
  });

  it('hides a card reserved unseen from everyone but its owner', () => {
    const start = newGame();
    const owner = active(start);
    const cardId = start.decks[2].at(-1) as string;
    const state = apply(start, { type: 'RESERVE_FROM_DECK', tier: 2 });

    const own = engine.getPublicView(state, asPlayer(owner));
    expect(own.players[owner]?.reserved).toEqual([
      { hidden: false, card: cards.find((card) => card.id === cardId) },
    ]);

    for (const viewer of [asPlayer(other(start)), SPECTATOR, ADMIN]) {
      const view = engine.getPublicView(state, viewer);
      expect(view.players[owner]?.reserved).toEqual([{ hidden: true, tier: 2 }]);
      expect(JSON.stringify(view)).not.toContain(`"${cardId}"`);
    }
  });

  it('keeps a card reserved from the market visible to all', () => {
    const start = newGame();
    const owner = active(start);
    const cardId = start.market[1][2] as string;
    const state = apply(start, { type: 'RESERVE_CARD', cardId });

    for (const viewer of [asPlayer(owner), asPlayer(other(start)), SPECTATOR]) {
      const reserved = engine.getPublicView(state, viewer).players[owner]?.reserved;
      expect(reserved).toEqual([{ hidden: false, card: expect.objectContaining({ id: cardId }) }]);
    }
  });

  it('derives bonuses and points from what a player holds', () => {
    const start = newGame();
    const owner = active(start);
    const state = {
      ...start,
      players: {
        ...start.players,
        [owner]: {
          ...start.players[owner]!,
          purchased: ['white-L1-02', 'white-L3-04', 'red-L1-01'],
        },
      },
    };
    const view = engine.getPublicView(state, SPECTATOR).players[owner];
    expect(view?.bonuses).toEqual({ white: 2, blue: 0, green: 0, red: 1, black: 0 });
    expect(view?.points).toBe(6);
  });

  it('lists legal moves for the player to move and nobody else', () => {
    const state = newGame();
    const mine = engine.getPublicView(state, asPlayer(active(state))).legal;
    expect(mine.gemColors).toHaveLength(5);
    expect(mine.takeCount).toBe(3);
    expect(mine.doubleColors).toHaveLength(5);
    expect(mine.reservable).toHaveLength(12);
    expect(mine.reservableTiers).toEqual([1, 2, 3]);
    expect(mine.buyable).toEqual([]);
    expect(mine.canPass).toBe(false);

    expect(engine.getPublicView(state, asPlayer(other(state))).legal).toEqual(NO_LEGAL_MOVES);
    expect(engine.getPublicView(state, SPECTATOR).legal).toEqual(NO_LEGAL_MOVES);
    expect(
      engine.getPublicView({ ...state, phase: 'FINISHED' }, asPlayer(active(state))).legal,
    ).toEqual(NO_LEGAL_MOVES);
  });

  it('tells a seated viewer how far each card they could buy is, on any turn', () => {
    const start = newGame();
    const owner = active(start);
    const rival = other(start);
    const state = apply(start, { type: 'RESERVE_FROM_DECK', tier: 2 });
    const held = state.players[owner]!.reserved[0]!.cardId;
    const faceUp = [1, 2, 3].flatMap((tier) => state.market[tier as 1 | 2 | 3]) as string[];

    // The owner is no longer to move, and still sees what their own reserve would take.
    const own = engine.getPublicView(state, asPlayer(owner));
    expect(Object.keys(own.shortfalls).sort()).toEqual([...faceUp, held].sort());
    expect(own.shortfalls[held]?.short).toBeGreaterThan(0);

    // The rival is to move: affordable is exactly what `legal` lets them buy.
    const theirs = engine.getPublicView(state, asPlayer(rival));
    expect(Object.keys(theirs.shortfalls).sort()).toEqual([...faceUp].sort());
    const affordable = Object.keys(theirs.shortfalls).filter(
      (cardId) => theirs.shortfalls[cardId]?.short === 0,
    );
    expect(affordable.sort()).toEqual([...theirs.legal.buyable].sort());

    expect(engine.getPublicView(state, SPECTATOR).shortfalls).toEqual({});
    expect(engine.getPublicView(state, ADMIN).shortfalls).toEqual({});
  });

  it('does not change when hidden cards swap places', () => {
    const start = newGame();
    const viewer = asPlayer(other(start));
    const state = apply(start, { type: 'RESERVE_FROM_DECK', tier: 1 });
    const owner = active(start);
    const held = state.players[owner]!.reserved[0]!.cardId;
    const inDeck = state.decks[1][0] as string;
    const swapped = {
      ...state,
      decks: { ...state.decks, 1: [held, ...state.decks[1].slice(1)].reverse() },
      players: {
        ...state.players,
        [owner]: { ...state.players[owner]!, reserved: [{ cardId: inDeck, blind: true }] },
      },
    };
    expect(engine.getPublicView(swapped, viewer)).toEqual(engine.getPublicView(state, viewer));
  });
});
