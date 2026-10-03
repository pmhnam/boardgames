import { expect } from 'vitest';
import { deepFreeze, seats } from '@bgp/game-core/testing';
import type { SplendorAction } from '../../src/domain/actions.js';
import { emptyGems, emptyTokens, type GemCounts, type TokenCounts } from '../../src/domain/gems.js';
import type { PlayerState, SplendorState } from '../../src/domain/state.js';
import { SplendorGame } from '../../src/index.js';

export const engine = SplendorGame.engine;
export const gameConfig = engine.defaultConfig;
export const cards = gameConfig.cards;

export const P1 = 'p1';
export const P2 = 'p2';

export function context(actorPlayerId: string) {
  return { actorPlayerId, requestId: 'req', now: '2000-01-01T00:00:00.000Z' };
}

export function tokens(counts: Partial<TokenCounts> = {}): TokenCounts {
  return { ...emptyTokens(), ...counts };
}

export function gems(counts: Partial<GemCounts> = {}): GemCounts {
  return { ...emptyGems(), ...counts };
}

/** A fresh game, with optional overrides, frozen so mutation fails loudly. */
export function newGame(
  overrides: Partial<SplendorState> = {},
  options: { seed?: string; players?: number; targetScore?: number } = {},
): SplendorState {
  const state = engine.createInitialState({
    gameId: 'g',
    players: seats(options.players ?? 2),
    seed: options.seed ?? 'fixture',
    config: gameConfig,
    settings: { targetScore: options.targetScore ?? gameConfig.defaultTargetScore },
  });
  return deepFreeze({ ...state, ...overrides });
}

export function active(state: SplendorState): string {
  return state.turn.activePlayerId;
}

export function other(state: SplendorState): string {
  const playerId = state.turnOrder.find((id) => id !== active(state));
  if (playerId === undefined) throw new Error('No other player');
  return playerId;
}

/** Replaces parts of one player's holdings. */
export function withPlayer(
  state: SplendorState,
  playerId: string,
  patch: Partial<PlayerState>,
): SplendorState {
  const player = state.players[playerId];
  if (!player) throw new Error(`Unknown player ${playerId}`);
  return deepFreeze({
    ...state,
    players: { ...state.players, [playerId]: { ...player, ...patch } },
  });
}

export function apply(
  state: SplendorState,
  action: SplendorAction,
  playerId = active(state),
): SplendorState {
  return deepFreeze(engine.applyAction(state, action, context(playerId)));
}

export function validate(state: SplendorState, action: SplendorAction, playerId = active(state)) {
  return engine.validateAction(state, action, context(playerId));
}

/** Ids of cards of one colour and tier still in the decks, so tests can hand them out. */
export function cardIds(bonus: string, tier: number): string[] {
  return cards.filter((card) => card.bonus === bonus && card.tier === tier).map((card) => card.id);
}

/**
 * Puts the given cards face up in their tiers (first slots) and takes them out of wherever
 * the shuffle put them, so every card stays in exactly one place.
 */
export function withMarket(state: SplendorState, wanted: string[]): SplendorState {
  const decks = { 1: [...state.decks[1]], 2: [...state.decks[2]], 3: [...state.decks[3]] };
  const market = { 1: [...state.market[1]], 2: [...state.market[2]], 3: [...state.market[3]] };
  const next = { 1: 0, 2: 0, 3: 0 };
  for (const cardId of wanted) {
    const card = cards.find((candidate) => candidate.id === cardId);
    if (!card) throw new Error(`Unknown card ${cardId}`);
    const tier = card.tier;
    const slot = next[tier]++;
    const faceUpAt = market[tier].indexOf(cardId);
    const inDeckAt = decks[tier].indexOf(cardId);
    const displaced = market[tier][slot] ?? null;
    if (faceUpAt !== -1) {
      market[tier][faceUpAt] = displaced;
    } else if (inDeckAt !== -1) {
      if (displaced === null) decks[tier].splice(inDeckAt, 1);
      else decks[tier][inDeckAt] = displaced;
    } else {
      throw new Error(`Card ${cardId} is already held by a player`);
    }
    market[tier][slot] = cardId;
  }
  return deepFreeze({ ...state, decks, market });
}

/** Takes cards out of the decks and market so a test can put them in a player's hands. */
export function withoutCards(state: SplendorState, taken: string[]): SplendorState {
  const strip = (ids: string[]) => ids.filter((id) => !taken.includes(id));
  const blank = (ids: (string | null)[]) => ids.map((id) => (id && taken.includes(id) ? null : id));
  return deepFreeze({
    ...state,
    decks: { 1: strip(state.decks[1]), 2: strip(state.decks[2]), 3: strip(state.decks[3]) },
    market: { 1: blank(state.market[1]), 2: blank(state.market[2]), 3: blank(state.market[3]) },
  });
}

/** Gives a player purchased cards, removing them from the table first. */
export function withPurchased(
  state: SplendorState,
  playerId: string,
  purchased: string[],
): SplendorState {
  return withPlayer(withoutCards(state, purchased), playerId, { purchased });
}

/** An illegal action must be refused by the validator and by the reducer, with the same code. */
export function expectRejected(
  state: SplendorState,
  action: SplendorAction,
  code: string,
  playerId = active(state),
): void {
  expect(validate(state, action, playerId)).toMatchObject({ valid: false, code });
  expect(() => engine.applyAction(state, action, context(playerId))).toThrowError(
    expect.objectContaining({ code }),
  );
}
