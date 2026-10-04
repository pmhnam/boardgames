import { expect } from 'vitest';
import { deepFreeze, seats } from '@bgp/game-core/testing';
import type { BangAction } from '../../src/domain/actions.js';
import type { CardKind, Suit } from '../../src/domain/cards.js';
import type { CharacterId } from '../../src/domain/characters.js';
import type { BangConfig } from '../../src/domain/game-config.js';
import type { RoleCounts, RoleId } from '../../src/domain/roles.js';
import type { BangState, PlayerState } from '../../src/domain/state.js';
import { BangGame } from '../../src/index.js';

export const engine = BangGame.engine;
export const gameConfig = engine.defaultConfig;

export const SPECTATOR = { type: 'spectator' } as const;

/**
 * A character with no ability, which no real match deals. Fixtures seat it everywhere a test
 * does not ask for someone in particular, so that a rule is tested without sixteen
 * exceptions to it getting in the way.
 */
export const PLAIN = 'nobody' as CharacterId;

/** The roles fixtures give seats that do not ask for one. */
const DEFAULT_ROLES: RoleId[] = [
  'sheriff',
  'renegade',
  'outlaw',
  'outlaw',
  'deputy',
  'outlaw',
  'deputy',
];
const DEFAULT_LIFE = 4;

/** A card by what it is, and where it matters by its suit and rank too. */
export type CardSpec = CardKind | { kind?: CardKind; suit?: Suit; rank?: number };

export interface SeatSpec {
  role?: RoleId;
  character?: CharacterId;
  life?: number;
  maxLife?: number;
  alive?: boolean;
  hand?: CardSpec[];
  inPlay?: CardSpec[];
}

export interface TableOptions {
  /** Whose turn it is. They are free to play: the turn's earlier steps are behind them. */
  turn?: string;
  /** The next cards off the deck, first drawn first. */
  deckTop?: CardSpec[];
  /** The discard pile, bottom first. */
  discard?: CardSpec[];
  /** Puts every card not asked for under the discard pile, leaving the deck just its top. */
  emptyDeck?: boolean;
  bangsPlayed?: number;
  config?: BangConfig;
}

export function asPlayer(playerId: string) {
  return { type: 'player', playerId } as const;
}

export function context(actorPlayerId: string) {
  return { actorPlayerId, requestId: 'req', now: '2000-01-01T00:00:00.000Z' };
}

/** A config that differs from the default only in what a test cares about. */
export function configWith(patch: {
  rules?: Partial<BangConfig['rules']>;
  characters?: Partial<BangConfig['characters']>;
  roles?: Partial<BangConfig['roles']>;
  cards?: BangConfig['cards'];
}): BangConfig {
  return {
    cards: patch.cards ?? gameConfig.cards,
    rules: { ...gameConfig.rules, ...patch.rules },
    characters: { ...gameConfig.characters, ...patch.characters },
    roles: { ...gameConfig.roles, ...patch.roles } as BangConfig['roles'],
  };
}

export function newGame(playerCount: number, seed = 'seed', config = gameConfig): BangState {
  return deepFreeze(
    engine.createInitialState({
      gameId: 'g',
      players: seats(playerCount),
      seed,
      config,
      settings: {},
    }),
  );
}

/**
 * A match arranged card by card: seat N of `specs` is player `pN`. Nothing depends on what a
 * seed happens to shuffle, and every card of the deck is still somewhere.
 */
export function table(specs: SeatSpec[], options: TableOptions = {}): BangState {
  const config = options.config ?? gameConfig;
  const base = engine.createInitialState({
    gameId: 'g',
    players: seats(specs.length),
    seed: 'fixture',
    config,
    settings: {},
  });

  const free = Object.keys(base.cards);
  const take = (spec: CardSpec): string => {
    const wanted = typeof spec === 'string' ? { kind: spec } : spec;
    const at = free.findIndex((cardId) => {
      const card = base.cards[cardId];
      return (
        card !== undefined &&
        (wanted.kind === undefined || card.kind === wanted.kind) &&
        (wanted.suit === undefined || card.suit === wanted.suit) &&
        (wanted.rank === undefined || card.rank === wanted.rank)
      );
    });
    const [cardId] = at < 0 ? [] : free.splice(at, 1);
    if (cardId === undefined) throw new Error(`No card left for ${JSON.stringify(spec)}`);
    return cardId;
  };

  const players: Record<string, PlayerState> = {};
  const roleCounts: RoleCounts = { sheriff: 0, deputy: 0, outlaw: 0, renegade: 0 };
  specs.forEach((spec, index) => {
    const role = spec.role ?? DEFAULT_ROLES[index] ?? 'outlaw';
    const maxLife = spec.maxLife ?? DEFAULT_LIFE;
    roleCounts[role] += 1;
    players[`p${index + 1}`] = {
      role,
      character: spec.character ?? PLAIN,
      alive: spec.alive ?? true,
      life: spec.alive === false ? 0 : (spec.life ?? maxLife),
      maxLife,
      hand: (spec.hand ?? []).map(take),
      inPlay: (spec.inPlay ?? []).map(take),
    };
  });
  const top = (options.deckTop ?? []).map(take);
  const discard = (options.discard ?? []).map(take);

  return deepFreeze({
    ...base,
    setup: { rules: { ...config.rules }, roleCounts },
    players,
    deck: [...(options.emptyDeck ? [] : free), ...top.reverse()],
    discard: [...(options.emptyDeck ? free : []), ...discard],
    turn: {
      number: 1,
      playerId: options.turn ?? 'p1',
      step: 'PLAY',
      bangsPlayed: options.bangsPlayed ?? 0,
    },
    pending: [],
    log: [],
    logSeq: 0,
  });
}

export function apply(state: BangState, action: BangAction, playerId: string): BangState {
  return deepFreeze(engine.applyAction(state, action, context(playerId)));
}

export function validate(state: BangState, action: BangAction, playerId: string) {
  return engine.validateAction(state, action, context(playerId));
}

/** An illegal action must be refused by the validator and by the reducer, with the same code. */
export function expectRejected(
  state: BangState,
  action: BangAction,
  code: string,
  playerId: string,
): void {
  expect(validate(state, action, playerId)).toMatchObject({ valid: false, code });
  expect(() => engine.applyAction(state, action, context(playerId))).toThrowError(
    expect.objectContaining({ code }),
  );
}

export function viewFor(state: BangState, playerId: string) {
  return engine.getPublicView(state, asPlayer(playerId));
}

export function legalFor(state: BangState, playerId: string) {
  const me = viewFor(state, playerId).me;
  if (!me) throw new Error(`${playerId} has no view of their own`);
  return me.legal;
}

export function player(state: BangState, playerId: string): PlayerState {
  const found = state.players[playerId];
  if (!found) throw new Error(`Unknown player ${playerId}`);
  return found;
}

export function kinds(state: BangState, cardIds: readonly string[]): CardKind[] {
  return cardIds.map((cardId) => state.cards[cardId]?.kind ?? 'bang');
}

export function handOf(state: BangState, playerId: string): CardKind[] {
  return kinds(state, player(state, playerId).hand);
}

export function inPlayOf(state: BangState, playerId: string): CardKind[] {
  return kinds(state, player(state, playerId).inPlay);
}

/** The id of a card of this kind that a player holds, in hand or on the table. */
export function cardOf(state: BangState, playerId: string, kind: CardKind): string {
  const held = player(state, playerId);
  const cardId = [...held.hand, ...held.inPlay].find((id) => state.cards[id]?.kind === kind);
  if (cardId === undefined) throw new Error(`${playerId} holds no ${kind}`);
  return cardId;
}

export function playAction(
  state: BangState,
  playerId: string,
  kind: CardKind,
  targetId: string | null = null,
  /** For a Panic! or a Cat Balou: the kind of card to take off the table. */
  targetCard: CardKind | null = null,
): BangAction {
  return {
    type: 'PLAY_CARD',
    cardId: cardOf(state, playerId, kind),
    targetId,
    targetCardId: targetCard && targetId ? cardOf(state, targetId, targetCard) : null,
  };
}

export function play(
  state: BangState,
  playerId: string,
  kind: CardKind,
  targetId: string | null = null,
  targetCard: CardKind | null = null,
): BangState {
  return apply(state, playAction(state, playerId, kind, targetId, targetCard), playerId);
}

/** Answers with a card of the kind, or with null takes what is coming. */
export function respond(state: BangState, playerId: string, kind: CardKind | null): BangState {
  const cardId = kind === null ? null : cardOf(state, playerId, kind);
  return apply(state, { type: 'RESPOND', cardId }, playerId);
}

/** Ends the turn, discarding from the end of the hand whatever is over the limit. */
export function endTurn(state: BangState, playerId: string): BangState {
  const held = player(state, playerId);
  const over = Math.max(0, held.hand.length - held.life);
  return apply(
    state,
    { type: 'END_TURN', discardIds: over > 0 ? held.hand.slice(-over) : [] },
    playerId,
  );
}

export function topOfDiscard(state: BangState): CardKind | undefined {
  return kinds(state, state.discard.slice(-1))[0];
}

/** Every card id in the match, wherever it is. Each must appear exactly once. */
export function listAllCards(state: BangState): string[] {
  return [
    ...state.deck,
    ...state.discard,
    ...Object.values(state.players).flatMap((held) => [...held.hand, ...held.inPlay]),
    ...state.pending.flatMap((frame) =>
      frame.type === 'STORE' || frame.type === 'KIT' ? frame.cardIds : [],
    ),
  ];
}
