import { GameRuleError, type GameActionContext } from '@bgp/game-core';
import type { CatanAction } from '../domain/actions.js';
import { ROAD_BUILDING_ROADS, ROBBER_ROLL } from '../domain/config.js';
import type { PlayableCardType } from '../domain/development-cards.js';
import type { Costs } from '../domain/game-config.js';
import {
  addResources,
  emptyResources,
  resources,
  type Resource,
  type ResourceCounts,
} from '../domain/resources.js';
import type { CatanState, CatanTurn, PlayerState } from '../domain/state.js';
import { drawRandom } from '../random/draw.js';
import { isRoadFree } from '../rules/build.rules.js';
import { findWinner } from '../rules/end-game.rules.js';
import { getPiecesLeft, listRoadSites } from '../rules/placement.rules.js';
import { getOpeningYield, getProduction } from '../rules/production.rules.js';
import { getDiscardsOwed, listCards } from '../rules/robber.rules.js';
import { getSupplyRates } from '../rules/trade.rules.js';
import {
  getNextPlayerId,
  getPlayer,
  getSetupPlayerId,
  getSetupTurns,
  isLastSetupRound,
} from '../rules/turn.rules.js';
import { resolveLongestRoute } from '../scoring/longest-route.js';
import { resolveLargestArmy } from '../scoring/score.js';
import { validateAction } from './validate-action.js';

const DIE_SIDES = 6;

function withPlayer(state: CatanState, playerId: string, patch: Partial<PlayerState>): CatanState {
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...getPlayer(state, playerId), ...patch } },
  };
}

function withTurn(state: CatanState, patch: Partial<CatanTurn>): CatanState {
  return { ...state, turn: { ...state.turn, ...patch } };
}

/** Moves cards from the supply to a player. */
function grant(
  state: CatanState,
  playerId: string,
  cards: Readonly<Partial<ResourceCounts>>,
): CatanState {
  return withPlayer({ ...state, supply: addResources(state.supply, cards, -1) }, playerId, {
    resources: addResources(getPlayer(state, playerId).resources, cards),
  });
}

/** Moves cards from a player back to the supply. */
function pay(
  state: CatanState,
  playerId: string,
  cards: Readonly<Partial<ResourceCounts>>,
): CatanState {
  return withPlayer({ ...state, supply: addResources(state.supply, cards) }, playerId, {
    resources: addResources(getPlayer(state, playerId).resources, cards, -1),
  });
}

/** Moves cards from one player to another. */
function hand(
  state: CatanState,
  fromId: string,
  toId: string,
  cards: Readonly<Partial<ResourceCounts>>,
): CatanState {
  const taken = withPlayer(state, fromId, {
    resources: addResources(getPlayer(state, fromId).resources, cards, -1),
  });
  return withPlayer(taken, toId, {
    resources: addResources(getPlayer(taken, toId).resources, cards),
  });
}

function payFor(state: CatanState, playerId: string, item: keyof Costs): CatanState {
  return pay(state, playerId, state.config.costs[item]);
}

/** A new road or a settlement cutting one can both move Longest Route. */
function withLongestRoute(state: CatanState): CatanState {
  return { ...state, longestRoutePlayerId: resolveLongestRoute(state) };
}

function startTurn(state: CatanState, activePlayerId: string, step: CatanTurn['step']): CatanState {
  return {
    ...state,
    turn: {
      number: state.turn.number + 1,
      activePlayerId,
      step,
      roll: null,
      developmentCardPlayed: false,
      freeRoads: 0,
      pendingDiscards: {},
      setupVertex: null,
      offer: null,
    },
  };
}

function applyPlaceSetupSettlement(
  state: CatanState,
  playerId: string,
  vertex: string,
): CatanState {
  const placed: CatanState = {
    ...state,
    buildings: { ...state.buildings, [vertex]: { playerId, kind: 'settlement' } },
  };
  const settled = isLastSetupRound(placed)
    ? grant(placed, playerId, getOpeningYield(placed, vertex))
    : placed;
  return withTurn(settled, { step: 'SETUP_ROAD', setupVertex: vertex });
}

function applyPlaceSetupRoad(state: CatanState, playerId: string, edge: string): CatanState {
  const placed = withLongestRoute({ ...state, roads: { ...state.roads, [edge]: playerId } });
  const nextNumber = placed.turn.number + 1;
  const firstPlayerId = placed.turnOrder[0];
  if (firstPlayerId === undefined) throw new Error('No players');
  return nextNumber > getSetupTurns(placed)
    ? startTurn(placed, firstPlayerId, 'ROLL')
    : startTurn(placed, getSetupPlayerId(placed.turnOrder, nextNumber), 'SETUP_SETTLEMENT');
}

function applyRollDice(state: CatanState): CatanState {
  const { source, next } = drawRandom(state.random);
  const roll: [number, number] = [source.int(DIE_SIDES) + 1, source.int(DIE_SIDES) + 1];
  const rolled = withTurn({ ...state, random: next }, { roll });
  const total = roll[0] + roll[1];

  if (total === ROBBER_ROLL) {
    const pendingDiscards = getDiscardsOwed(rolled);
    const step = Object.keys(pendingDiscards).length > 0 ? 'DISCARD' : 'ROBBER';
    return withTurn(rolled, { step, pendingDiscards });
  }

  let produced = rolled;
  for (const [playerId, cards] of Object.entries(getProduction(rolled, total))) {
    produced = grant(produced, playerId, cards);
  }
  return withTurn(produced, { step: 'MAIN' });
}

function applyDiscard(
  state: CatanState,
  playerId: string,
  discarded: Readonly<Partial<ResourceCounts>>,
): CatanState {
  const pendingDiscards = { ...state.turn.pendingDiscards };
  delete pendingDiscards[playerId];
  const everyoneDone = Object.keys(pendingDiscards).length === 0;
  return withTurn(pay(state, playerId, discarded), {
    pendingDiscards,
    step: everyoneDone ? 'ROBBER' : 'DISCARD',
  });
}

function applyMoveRobber(
  state: CatanState,
  playerId: string,
  hex: string,
  victimId: string | undefined,
): CatanState {
  // A knight played before the roll leaves the roll still to come.
  let moved = withTurn({ ...state, robber: hex }, { step: state.turn.roll ? 'MAIN' : 'ROLL' });
  if (victimId === undefined) return moved;

  const { source, next } = drawRandom(moved.random);
  const stolen = source.pick(listCards(getPlayer(moved, victimId).resources));
  moved = hand({ ...moved, random: next }, victimId, playerId, { [stolen]: 1 });
  return moved;
}

function applyBuildRoad(state: CatanState, playerId: string, edge: string): CatanState {
  const free = isRoadFree(state);
  const paid = free ? state : payFor(state, playerId, 'road');
  const built = withLongestRoute({ ...paid, roads: { ...paid.roads, [edge]: playerId } });
  if (!free) return built;

  // The second free road is lost if there is nowhere to put it, or nothing to put.
  const left = built.turn.freeRoads - 1;
  const canPlaceMore =
    getPiecesLeft(built, playerId).roads > 0 && listRoadSites(built, playerId).length > 0;
  return withTurn(built, { freeRoads: canPlaceMore ? left : 0 });
}

function applyBuildSettlement(state: CatanState, playerId: string, vertex: string): CatanState {
  const paid = payFor(state, playerId, 'settlement');
  return withLongestRoute({
    ...paid,
    buildings: { ...paid.buildings, [vertex]: { playerId, kind: 'settlement' } },
  });
}

function applyBuildCity(state: CatanState, playerId: string, vertex: string): CatanState {
  const paid = payFor(state, playerId, 'city');
  return { ...paid, buildings: { ...paid.buildings, [vertex]: { playerId, kind: 'city' } } };
}

function applyBuyDevelopmentCard(state: CatanState, playerId: string): CatanState {
  const developmentDeck = [...state.developmentDeck];
  const type = developmentDeck.pop();
  if (type === undefined) throw new Error('The development deck is empty');
  const paid = payFor({ ...state, developmentDeck }, playerId, 'developmentCard');
  return withPlayer(paid, playerId, {
    developmentCards: [
      ...getPlayer(paid, playerId).developmentCards,
      { type, boughtOnTurn: state.turn.number },
    ],
  });
}

/** Takes one playable card of a type out of the hand and marks the turn's play as used. */
function playCard(state: CatanState, playerId: string, type: PlayableCardType): CatanState {
  const held = getPlayer(state, playerId).developmentCards;
  const index = held.findIndex(
    (card) => card.type === type && card.boughtOnTurn < state.turn.number,
  );
  if (index === -1) throw new Error(`Player ${playerId} holds no playable ${type}`);
  return withTurn(
    withPlayer(state, playerId, { developmentCards: held.filter((_, at) => at !== index) }),
    { developmentCardPlayed: true },
  );
}

function applyPlayKnight(state: CatanState, playerId: string): CatanState {
  const played = playCard(state, playerId, 'knight');
  const armed = withPlayer(played, playerId, {
    knightsPlayed: getPlayer(played, playerId).knightsPlayed + 1,
  });
  return withTurn(
    { ...armed, largestArmyPlayerId: resolveLargestArmy(armed, playerId) },
    { step: 'ROBBER' },
  );
}

function applyPlayRoadBuilding(state: CatanState, playerId: string): CatanState {
  const played = playCard(state, playerId, 'roadBuilding');
  return withTurn(played, {
    freeRoads: Math.min(ROAD_BUILDING_ROADS, getPiecesLeft(played, playerId).roads),
  });
}

function applyPlayInvention(
  state: CatanState,
  playerId: string,
  picks: readonly Resource[],
): CatanState {
  const taken = emptyResources();
  for (const resource of picks) taken[resource] += 1;
  return grant(playCard(state, playerId, 'invention'), playerId, taken);
}

/** Every other player hands over all they hold of one resource. */
function applyPlayMonopoly(state: CatanState, playerId: string, resource: Resource): CatanState {
  let collected = playCard(state, playerId, 'monopoly');
  for (const otherId of collected.turnOrder) {
    if (otherId === playerId) continue;
    const held = getPlayer(collected, otherId).resources[resource];
    if (held > 0) collected = hand(collected, otherId, playerId, { [resource]: held });
  }
  return collected;
}

function applySupplyTrade(
  state: CatanState,
  playerId: string,
  give: Resource,
  receive: Resource,
): CatanState {
  const rate = getSupplyRates(state, playerId)[give];
  return grant(pay(state, playerId, { [give]: rate }), playerId, { [receive]: 1 });
}

function applyConfirmTrade(state: CatanState, playerId: string, partnerId: string): CatanState {
  const { offer } = state.turn;
  if (!offer) throw new Error('No offer to confirm');
  const given = hand(state, playerId, partnerId, offer.give);
  return withTurn(hand(given, partnerId, playerId, offer.receive), { offer: null });
}

function reduce(state: CatanState, action: CatanAction, playerId: string): CatanState {
  switch (action.type) {
    case 'PLACE_SETUP_SETTLEMENT':
      return applyPlaceSetupSettlement(state, playerId, action.vertex);
    case 'PLACE_SETUP_ROAD':
      return applyPlaceSetupRoad(state, playerId, action.edge);
    case 'ROLL_DICE':
      return applyRollDice(state);
    case 'DISCARD':
      return applyDiscard(state, playerId, action.resources);
    case 'MOVE_ROBBER':
      return applyMoveRobber(state, playerId, action.hex, action.victimId);
    case 'BUILD_ROAD':
      return applyBuildRoad(state, playerId, action.edge);
    case 'BUILD_SETTLEMENT':
      return applyBuildSettlement(state, playerId, action.vertex);
    case 'BUILD_CITY':
      return applyBuildCity(state, playerId, action.vertex);
    case 'BUY_DEVELOPMENT_CARD':
      return applyBuyDevelopmentCard(state, playerId);
    case 'PLAY_KNIGHT':
      return applyPlayKnight(state, playerId);
    case 'PLAY_ROAD_BUILDING':
      return applyPlayRoadBuilding(state, playerId);
    case 'PLAY_INVENTION':
      return applyPlayInvention(state, playerId, action.resources);
    case 'PLAY_MONOPOLY':
      return applyPlayMonopoly(state, playerId, action.resource);
    case 'SUPPLY_TRADE':
      return applySupplyTrade(state, playerId, action.give, action.receive);
    case 'PROPOSE_TRADE':
      return withTurn(
        { ...state, offersMade: state.offersMade + 1 },
        {
          offer: {
            id: state.offersMade + 1,
            give: resources(action.give),
            receive: resources(action.receive),
            responses: {},
          },
        },
      );
    case 'RESPOND_TRADE':
      if (!state.turn.offer) throw new Error('No offer to answer');
      return withTurn(state, {
        offer: {
          ...state.turn.offer,
          responses: {
            ...state.turn.offer.responses,
            [playerId]: action.accept ? 'accepted' : 'declined',
          },
        },
      });
    case 'CONFIRM_TRADE':
      return applyConfirmTrade(state, playerId, action.playerId);
    case 'CANCEL_TRADE':
      return withTurn(state, { offer: null });
    case 'END_TURN':
      return startTurn(state, getNextPlayerId(state, playerId), 'ROLL');
  }
}

export function applyAction(
  state: CatanState,
  action: CatanAction,
  context: GameActionContext,
): CatanState {
  const validation = validateAction(state, action, context);
  if (!validation.valid) throw new GameRuleError(validation.code, validation.message);

  const next = reduce(state, action, context.actorPlayerId);
  // Checked after everything, the start of a turn included: points can arrive on someone
  // else's turn, but they only win the game on the player's own.
  const winnerId = findWinner(next);
  return winnerId === null ? next : { ...next, phase: 'FINISHED', winnerPlayerIds: [winnerId] };
}
