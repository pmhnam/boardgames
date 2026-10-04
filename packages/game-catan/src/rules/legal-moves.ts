import type { CatanAction } from '../domain/actions.js';
import { INVENTION_CARDS } from '../domain/config.js';
import type { PlayableCardType } from '../domain/development-cards.js';
import {
  RESOURCES,
  hasResources,
  type Resource,
  type ResourceCounts,
} from '../domain/resources.js';
import type { CatanState, TurnStep } from '../domain/state.js';
import {
  validateBuyDevelopmentCard,
  validateMayBuildCity,
  validateMayBuildRoad,
  validateMayBuildSettlement,
} from './build.rules.js';
import { listPlayableCards } from './development.rules.js';
import {
  listCitySites,
  listOpeningSettlementSites,
  listRoadSites,
  listSettlementSites,
  listSetupRoadSites,
} from './placement.rules.js';
import { getRobberVictims, listRobberHexes } from './robber.rules.js';
import { listAccepters } from './trade.rules.js';
import { getPlayer } from './turn.rules.js';

/** What a seated player may do right now, whether or not it is their turn. */
export interface LegalMoves {
  /** Corners a settlement may go on now: any free one in the opening, a paid-for one later. */
  settlementVertices: string[];
  /** Edges a road may go on now, paid for or free. */
  roadEdges: string[];
  /** The player's settlements a city may replace now. */
  cityVertices: string[];
  canRoll: boolean;
  /** Resource cards to give up to a 7. */
  mustDiscard: number;
  /** Hexes the robber may move to, each with the players who may be robbed there. */
  robberTargets: Record<string, string[]>;
  canBuyDevelopmentCard: boolean;
  playableCards: PlayableCardType[];
  /** Whether the player may trade with the supply and make offers to the others. */
  canTrade: boolean;
  /** An offer is waiting for this player's answer. */
  canRespond: boolean;
  /** They hold what it asks for, so the answer may be yes. */
  canAccept: boolean;
  /** The players who accepted this player's own offer. */
  accepters: string[];
  canCancelTrade: boolean;
  canEndTurn: boolean;
}

export const NO_LEGAL_MOVES: LegalMoves = {
  settlementVertices: [],
  roadEdges: [],
  cityVertices: [],
  canRoll: false,
  mustDiscard: 0,
  robberTargets: {},
  canBuyDevelopmentCard: false,
  playableCards: [],
  canTrade: false,
  canRespond: false,
  canAccept: false,
  accepters: [],
  canCancelTrade: false,
  canEndTurn: false,
};

function getRobberTargets(state: CatanState, playerId: string): Record<string, string[]> {
  return Object.fromEntries(
    listRobberHexes(state).map((hex) => [hex, getRobberVictims(state, playerId, hex)]),
  );
}

/** The single source of truth for what a player may do; the validator agrees with it. */
export function getLegalMoves(state: CatanState, playerId: string): LegalMoves {
  if (state.phase !== 'PLAYING' || !state.players[playerId]) return NO_LEGAL_MOVES;
  const { turn } = state;

  if (turn.step === 'DISCARD') {
    return { ...NO_LEGAL_MOVES, mustDiscard: turn.pendingDiscards[playerId] ?? 0 };
  }

  if (turn.activePlayerId !== playerId) {
    const waiting = turn.offer !== null && turn.offer.responses[playerId] === undefined;
    return {
      ...NO_LEGAL_MOVES,
      canRespond: waiting,
      canAccept:
        waiting &&
        turn.offer !== null &&
        hasResources(getPlayer(state, playerId).resources, turn.offer.receive),
    };
  }

  if (turn.offer) {
    return { ...NO_LEGAL_MOVES, accepters: listAccepters(state), canCancelTrade: true };
  }

  switch (turn.step) {
    case 'SETUP_SETTLEMENT':
      return { ...NO_LEGAL_MOVES, settlementVertices: listOpeningSettlementSites(state) };
    case 'SETUP_ROAD':
      return { ...NO_LEGAL_MOVES, roadEdges: listSetupRoadSites(state) };
    case 'ROBBER':
      return { ...NO_LEGAL_MOVES, robberTargets: getRobberTargets(state, playerId) };
    default:
  }

  const roadEdges = validateMayBuildRoad(state, playerId).valid
    ? listRoadSites(state, playerId)
    : [];
  // Free roads come before anything else, the roll included.
  if (turn.freeRoads > 0) return { ...NO_LEGAL_MOVES, roadEdges };

  const playableCards = listPlayableCards(state, playerId);
  if (turn.step === 'ROLL') return { ...NO_LEGAL_MOVES, canRoll: true, playableCards };

  return {
    ...NO_LEGAL_MOVES,
    settlementVertices: validateMayBuildSettlement(state, playerId).valid
      ? listSettlementSites(state, playerId)
      : [],
    roadEdges,
    cityVertices: validateMayBuildCity(state, playerId).valid ? listCitySites(state, playerId) : [],
    canBuyDevelopmentCard: validateBuyDevelopmentCard(state, playerId).valid,
    playableCards,
    canTrade: true,
    canEndTurn: true,
  };
}

/** Every way of giving up `count` of the cards held. */
export function listDiscards(
  hand: Readonly<ResourceCounts>,
  count: number,
): Partial<ResourceCounts>[] {
  const walk = (index: number, left: number): Partial<ResourceCounts>[] => {
    const resource = RESOURCES[index];
    if (resource === undefined) return left === 0 ? [{}] : [];
    const results: Partial<ResourceCounts>[] = [];
    for (let given = 0; given <= Math.min(left, hand[resource]); given += 1) {
      for (const rest of walk(index + 1, left - given)) {
        results.push(given > 0 ? { [resource]: given, ...rest } : rest);
      }
    }
    return results;
  };
  return walk(0, count);
}

/** Every pair of cards an Invention could take from the supply. */
function listInventionPicks(supply: Readonly<ResourceCounts>): Resource[][] {
  const picks: Resource[][] = [];
  RESOURCES.forEach((first, index) => {
    for (const second of RESOURCES.slice(index)) {
      const needed = first === second ? INVENTION_CARDS : 1;
      if (supply[first] >= needed && supply[second] >= needed) picks.push([first, second]);
    }
  });
  return picks;
}

function listCardPlays(type: PlayableCardType, supply: Readonly<ResourceCounts>): CatanAction[] {
  switch (type) {
    case 'knight':
      return [{ type: 'PLAY_KNIGHT' }];
    case 'roadBuilding':
      return [{ type: 'PLAY_ROAD_BUILDING' }];
    case 'invention':
      return listInventionPicks(supply).map((resources) => ({
        type: 'PLAY_INVENTION',
        resources,
      }));
    case 'monopoly':
      return RESOURCES.map((resource) => ({ type: 'PLAY_MONOPOLY', resource }));
  }
}

/** Every trade with the supply the player can pay for and the supply can honour. */
export function listSupplyTrades(
  hand: Readonly<ResourceCounts>,
  rates: Readonly<Record<Resource, number>>,
  supply: Readonly<ResourceCounts>,
): CatanAction[] {
  return RESOURCES.filter((give) => hand[give] >= rates[give]).flatMap((give) =>
    RESOURCES.filter((receive) => receive !== give && supply[receive] > 0).map(
      (receive): CatanAction => ({ type: 'SUPPLY_TRADE', give, receive }),
    ),
  );
}

/** What `listLegalActions` needs besides `legal`: all of it is in the view a seat is given. */
export interface SeatContext {
  step: TurnStep;
  /** The open trade offer, if there is one. */
  offerId: number | null;
  resources: Readonly<ResourceCounts>;
  supplyRates: Readonly<Record<Resource, number>>;
  supply: Readonly<ResourceCounts>;
}

/**
 * Spells out `legal` as concrete actions. It needs nothing but what the view shows a seat, so
 * a bot can use it. Offers to other players are left out: there is no end to them.
 */
export function listLegalActions(legal: LegalMoves, seat: SeatContext): CatanAction[] {
  if (legal.mustDiscard > 0) {
    return listDiscards(seat.resources, legal.mustDiscard).map((resources) => ({
      type: 'DISCARD',
      resources,
    }));
  }
  if (legal.canRespond && seat.offerId !== null) {
    const offerId = seat.offerId;
    return [
      ...(legal.canAccept ? [{ type: 'RESPOND_TRADE', offerId, accept: true } as const] : []),
      { type: 'RESPOND_TRADE', offerId, accept: false },
    ];
  }
  if (legal.canCancelTrade) {
    return [
      ...legal.accepters.map((playerId): CatanAction => ({ type: 'CONFIRM_TRADE', playerId })),
      { type: 'CANCEL_TRADE' },
    ];
  }

  const robberMoves = Object.entries(legal.robberTargets).flatMap(([hex, victims]) =>
    victims.length === 0
      ? [{ type: 'MOVE_ROBBER', hex } as const]
      : victims.map((victimId): CatanAction => ({ type: 'MOVE_ROBBER', hex, victimId })),
  );
  if (robberMoves.length > 0) return robberMoves;

  // In the opening the same sites are sent as placements, which cost nothing.
  if (seat.step === 'SETUP_SETTLEMENT') {
    return legal.settlementVertices.map((vertex) => ({ type: 'PLACE_SETUP_SETTLEMENT', vertex }));
  }
  if (seat.step === 'SETUP_ROAD') {
    return legal.roadEdges.map((edge) => ({ type: 'PLACE_SETUP_ROAD', edge }));
  }

  return [
    ...(legal.canRoll ? [{ type: 'ROLL_DICE' } as const] : []),
    ...legal.cityVertices.map((vertex): CatanAction => ({ type: 'BUILD_CITY', vertex })),
    ...legal.settlementVertices.map((vertex): CatanAction => ({
      type: 'BUILD_SETTLEMENT',
      vertex,
    })),
    ...legal.roadEdges.map((edge): CatanAction => ({ type: 'BUILD_ROAD', edge })),
    ...(legal.canBuyDevelopmentCard ? [{ type: 'BUY_DEVELOPMENT_CARD' } as const] : []),
    ...legal.playableCards.flatMap((type) => listCardPlays(type, seat.supply)),
    ...(legal.canTrade ? listSupplyTrades(seat.resources, seat.supplyRates, seat.supply) : []),
    ...(legal.canEndTurn ? [{ type: 'END_TURN' } as const] : []),
  ];
}
