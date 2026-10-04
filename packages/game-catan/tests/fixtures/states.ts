import { expect } from 'vitest';
import { deepFreeze, seats } from '@bgp/game-core/testing';
import type { CatanAction } from '../../src/domain/actions.js';
import type { DevelopmentCardType } from '../../src/domain/development-cards.js';
import type { Tile } from '../../src/domain/default-board.js';
import { layFrame, type CatanConfig } from '../../src/domain/game-config.js';
import { hexCorners, hexKey, hexSideEdge, type HexSide } from '../../src/domain/hex.js';
import {
  RESOURCES,
  emptyResources,
  type ResourceCounts,
  type Terrain,
} from '../../src/domain/resources.js';
import type { BuildingKind, CatanState, CatanTurn, PlayerState } from '../../src/domain/state.js';
import { CatanGame } from '../../src/index.js';
import { drawRandom } from '../../src/random/draw.js';
import { getSetupTurns } from '../../src/rules/turn.rules.js';

export const engine = CatanGame.engine;
export const gameConfig = engine.defaultConfig;

export function context(actorPlayerId: string) {
  return { actorPlayerId, requestId: 'req', now: '2000-01-01T00:00:00.000Z' };
}

export interface GameOptions {
  seed?: string;
  players?: number;
  config?: CatanConfig;
  /** Keep the island the variable setup dealt, rather than the one the tests know. */
  dealt?: boolean;
}

const tile = (terrain: Terrain, number: number | null = null): Tile => ({ terrain, number });

/** The island the rule tests are written against: the desert in the middle. */
const TEST_TILES: Tile[] = [
  tile('mountains', 10),
  tile('pasture', 2),
  tile('forest', 9),

  tile('fields', 12),
  tile('hills', 6),
  tile('pasture', 4),
  tile('hills', 10),

  tile('fields', 9),
  tile('forest', 11),
  tile('desert'),
  tile('forest', 3),
  tile('mountains', 8),

  tile('forest', 8),
  tile('mountains', 3),
  tile('fields', 4),
  tile('pasture', 5),

  tile('hills', 5),
  tile('fields', 6),
  tile('pasture', 11),
];

/**
 * A fresh game at the start of the opening, frozen so mutation fails loudly. Unless asked
 * otherwise it is given the test island and the frame in its fixed order, so tests know what
 * is on every hex and where every port is.
 */
export function newGame(overrides: Partial<CatanState> = {}, options: GameOptions = {}) {
  const config = options.config ?? gameConfig;
  const state = engine.createInitialState({
    gameId: 'g',
    players: seats(options.players ?? 3),
    seed: options.seed ?? 'fixture',
    config,
    settings: { boardSetup: 'variable' },
  });
  if (options.dealt) return deepFreeze({ ...state, ...overrides });

  const known: Partial<CatanState> = {
    tiles: Object.fromEntries(
      config.hexes.map((hex, index) => [hexKey(hex), TEST_TILES[index] as Tile]),
    ),
    robber: '0,0',
    config: {
      ...state.config,
      ports: layFrame(config.hexes, config.frame.start, config.frame.pieces),
    },
  };
  return deepFreeze({ ...state, ...known, ...overrides });
}

export function withTurn(state: CatanState, patch: Partial<CatanTurn>): CatanState {
  return deepFreeze({ ...state, turn: { ...state.turn, ...patch } });
}

/** A game past its opening with an empty board: the first player is about to roll. */
export function started(options: GameOptions = {}): CatanState {
  const state = newGame({}, options);
  return withTurn(state, { number: getSetupTurns(state) + 1, step: 'ROLL' });
}

/** The same, with the dice already rolled: the first player may build and trade. */
export function inMain(options: GameOptions = {}): CatanState {
  return withTurn(started(options), { step: 'MAIN', roll: [1, 2] });
}

export function active(state: CatanState): string {
  return state.turn.activePlayerId;
}

/** The players who are not on turn, in turn order. */
export function others(state: CatanState): string[] {
  return state.turnOrder.filter((playerId) => playerId !== active(state));
}

export function other(state: CatanState): string {
  const playerId = others(state)[0];
  if (playerId === undefined) throw new Error('No other player');
  return playerId;
}

export function player(state: CatanState, playerId: string): PlayerState {
  const found = state.players[playerId];
  if (!found) throw new Error(`Unknown player ${playerId}`);
  return found;
}

export function cards(counts: Partial<ResourceCounts> = {}): ResourceCounts {
  return { ...emptyResources(), ...counts };
}

/** Sets one player's hand, taking the cards out of the supply so none appear from nowhere. */
export function hold(
  state: CatanState,
  playerId: string,
  counts: Partial<ResourceCounts>,
): CatanState {
  const before = player(state, playerId).resources;
  const resources = cards(counts);
  const supply = { ...state.supply };
  for (const resource of RESOURCES) supply[resource] -= resources[resource] - before[resource];
  return deepFreeze({
    ...state,
    supply,
    players: { ...state.players, [playerId]: { ...player(state, playerId), resources } },
  });
}

/** Gives a player development cards from the deck, bought on an earlier turn by default. */
export function holdCards(
  state: CatanState,
  playerId: string,
  types: DevelopmentCardType[],
  boughtOnTurn = 0,
): CatanState {
  const developmentDeck = [...state.developmentDeck];
  for (const type of types) {
    const at = developmentDeck.indexOf(type);
    if (at === -1) throw new Error(`No ${type} left in the deck`);
    developmentDeck.splice(at, 1);
  }
  const held = player(state, playerId);
  return deepFreeze({
    ...state,
    developmentDeck,
    players: {
      ...state.players,
      [playerId]: {
        ...held,
        developmentCards: [
          ...held.developmentCards,
          ...types.map((type) => ({ type, boughtOnTurn })),
        ],
      },
    },
  });
}

/** A corner of a hex: 0 is the top, then clockwise. */
export function corner(q: number, r: number, index: number): string {
  const vertex = hexCorners({ q, r })[index];
  if (vertex === undefined) throw new Error(`No corner ${index}`);
  return vertex;
}

export function side(q: number, r: number, hexSide: HexSide): string {
  return hexSideEdge({ q, r }, hexSide);
}

export function build(
  state: CatanState,
  playerId: string,
  vertex: string,
  kind: BuildingKind = 'settlement',
): CatanState {
  return deepFreeze({
    ...state,
    buildings: { ...state.buildings, [vertex]: { playerId, kind } },
  });
}

export function pave(state: CatanState, playerId: string, ...edges: string[]): CatanState {
  const roads = { ...state.roads };
  for (const edge of edges) roads[edge] = playerId;
  return deepFreeze({ ...state, roads });
}

/** Sets the random source so the next roll of the dice adds up to `total`. */
export function rigDice(state: CatanState, total: number): CatanState {
  for (let draws = 0; draws < 10_000; draws += 1) {
    const { source } = drawRandom({ seed: state.random.seed, draws });
    if (source.int(6) + 1 + source.int(6) + 1 === total) {
      return deepFreeze({ ...state, random: { seed: state.random.seed, draws } });
    }
  }
  throw new Error(`No draw rolls ${total}`);
}

export function apply(
  state: CatanState,
  action: CatanAction,
  playerId = active(state),
): CatanState {
  return deepFreeze(engine.applyAction(state, action, context(playerId)));
}

export function validate(state: CatanState, action: CatanAction, playerId = active(state)) {
  return engine.validateAction(state, action, context(playerId));
}

/** An illegal action must be refused by the validator and by the reducer, with the same code. */
export function expectRejected(
  state: CatanState,
  action: CatanAction,
  code: string,
  playerId = active(state),
): void {
  expect(validate(state, action, playerId)).toMatchObject({ valid: false, code });
  expect(() => engine.applyAction(state, action, context(playerId))).toThrowError(
    expect.objectContaining({ code }),
  );
}

/** Every resource card is always either in the supply or in a hand. */
export function countAll(state: CatanState): ResourceCounts {
  const total = { ...state.supply };
  for (const held of Object.values(state.players)) {
    for (const resource of RESOURCES) total[resource] += held.resources[resource];
  }
  return total;
}
