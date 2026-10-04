import type { GameViewer } from '@bgp/game-core';
import type { Tile } from '../domain/default-board.js';
import type { DevelopmentCardType } from '../domain/development-cards.js';
import type { Costs, Port, Pieces } from '../domain/game-config.js';
import { hexKey, type Hex } from '../domain/hex.js';
import { countResources, type Resource, type ResourceCounts } from '../domain/resources.js';
import type {
  Building,
  CatanPhase,
  CatanState,
  PlayerState,
  TradeResponse,
  TurnStep,
} from '../domain/state.js';
import { NO_LEGAL_MOVES, getLegalMoves, type LegalMoves } from '../rules/legal-moves.js';
import { getPiecesLeft } from '../rules/placement.rules.js';
import { getSupplyRates } from '../rules/trade.rules.js';
import { getRouteLength } from '../scoring/longest-route.js';
import { getPoints, getPublicPoints } from '../scoring/score.js';

export interface HexView extends Hex, Tile {}

/** A development card in the viewer's own hand. */
export interface HeldCardView {
  type: DevelopmentCardType;
  /** Bought this turn, so not playable yet. */
  fresh: boolean;
}

export interface PlayerView {
  resourceCount: number;
  /** The hand itself: only the viewer's own, until the game is over. */
  resources: ResourceCounts | null;
  developmentCardCount: number;
  /** Only the viewer's own, until the game is over. */
  developmentCards: HeldCardView[] | null;
  knightsPlayed: number;
  routeLength: number;
  piecesLeft: Pieces;
  /** What the table can count: buildings, Longest Route and Largest Army. */
  publicPoints: number;
  /** With Victory Point cards: only the viewer's own, until the game is over. */
  points: number | null;
  /** Cards of each resource this player gives for one from the supply. */
  supplyRates: Record<Resource, number>;
}

export interface OfferView {
  /** What an answer to this offer must name. */
  id: number;
  give: ResourceCounts;
  receive: ResourceCounts;
  responses: Record<string, TradeResponse>;
}

export interface TurnView {
  number: number;
  activePlayerId: string;
  step: TurnStep;
  roll: [number, number] | null;
  developmentCardPlayed: boolean;
  freeRoads: number;
  /** How many cards each player still owes to a 7. */
  pendingDiscards: Record<string, number>;
  offer: OfferView | null;
}

export interface CatanView {
  id: string;
  phase: CatanPhase;
  turnOrder: string[];
  turn: TurnView;
  board: {
    hexes: HexView[];
    ports: Port[];
    robber: string;
  };
  buildings: Record<string, Building>;
  roads: Record<string, string>;
  supply: ResourceCounts;
  developmentDeckCount: number;
  players: Record<string, PlayerView>;
  longestRoutePlayerId: string | null;
  largestArmyPlayerId: string | null;
  victoryPointsToWin: number;
  /** The shortest road that can hold Longest Route, and the fewest knights for Largest Army. */
  longestRouteMinimum: number;
  largestArmyMinimum: number;
  /** A hand larger than this loses half to a 7. */
  discardLimit: number;
  costs: Costs;
  winnerPlayerIds: string[];
  /** What the viewer may do right now. Empty for anyone not seated. */
  legal: LegalMoves;
}

function getPlayerView(
  state: CatanState,
  playerId: string,
  player: PlayerState,
  revealed: boolean,
): PlayerView {
  return {
    resourceCount: countResources(player.resources),
    resources: revealed ? { ...player.resources } : null,
    developmentCardCount: player.developmentCards.length,
    developmentCards: revealed
      ? player.developmentCards.map((card) => ({
          type: card.type,
          fresh: card.boughtOnTurn === state.turn.number,
        }))
      : null,
    knightsPlayed: player.knightsPlayed,
    routeLength: getRouteLength(state, playerId),
    piecesLeft: getPiecesLeft(state, playerId),
    publicPoints: getPublicPoints(state, playerId),
    points: revealed ? getPoints(state, playerId) : null,
    supplyRates: getSupplyRates(state, playerId),
  };
}

function getHexViews(state: CatanState): HexView[] {
  return state.config.hexes.map((hex) => {
    const tile = state.tiles[hexKey(hex)];
    if (!tile) throw new Error(`No tile for hex ${hexKey(hex)}`);
    return { q: hex.q, r: hex.r, terrain: tile.terrain, number: tile.number };
  });
}

function copyCosts(costs: Costs): Costs {
  return {
    road: { ...costs.road },
    settlement: { ...costs.settlement },
    city: { ...costs.city },
    developmentCard: { ...costs.developmentCard },
  };
}

/**
 * Built field by field: hands and development cards leave as counts for everyone but their
 * owner, the deck leaves as a count, and the random source does not leave at all. Spectators
 * and admins see what an opponent would. Once the game is over, every hand is shown.
 */
export function getPublicView(state: CatanState, viewer: GameViewer): CatanView {
  const viewerId = viewer.type === 'player' ? viewer.playerId : null;
  const finished = state.phase === 'FINISHED';
  const { turn } = state;

  return {
    id: state.id,
    phase: state.phase,
    turnOrder: [...state.turnOrder],
    turn: {
      number: turn.number,
      activePlayerId: turn.activePlayerId,
      step: turn.step,
      roll: turn.roll ? [turn.roll[0], turn.roll[1]] : null,
      developmentCardPlayed: turn.developmentCardPlayed,
      freeRoads: turn.freeRoads,
      pendingDiscards: { ...turn.pendingDiscards },
      offer: turn.offer
        ? {
            id: turn.offer.id,
            give: { ...turn.offer.give },
            receive: { ...turn.offer.receive },
            responses: { ...turn.offer.responses },
          }
        : null,
    },
    board: {
      hexes: getHexViews(state),
      ports: state.config.ports.map((port) => ({ edge: port.edge, type: port.type })),
      robber: state.robber,
    },
    buildings: Object.fromEntries(
      Object.entries(state.buildings).map(([vertex, building]) => [
        vertex,
        { playerId: building.playerId, kind: building.kind },
      ]),
    ),
    roads: { ...state.roads },
    supply: { ...state.supply },
    developmentDeckCount: state.developmentDeck.length,
    players: Object.fromEntries(
      state.turnOrder.map((playerId) => {
        const player = state.players[playerId];
        if (!player) throw new Error(`Unknown player ${playerId}`);
        return [
          playerId,
          getPlayerView(state, playerId, player, finished || playerId === viewerId),
        ];
      }),
    ),
    longestRoutePlayerId: state.longestRoutePlayerId,
    largestArmyPlayerId: state.largestArmyPlayerId,
    victoryPointsToWin: state.config.victoryPointsToWin,
    longestRouteMinimum: state.config.longestRouteMinimum,
    largestArmyMinimum: state.config.largestArmyMinimum,
    discardLimit: state.config.discardLimit,
    costs: copyCosts(state.config.costs),
    winnerPlayerIds: [...state.winnerPlayerIds],
    legal: viewerId === null ? NO_LEGAL_MOVES : getLegalMoves(state, viewerId),
  };
}
