import type { GameValidationResult } from '@bgp/game-core';
import { GENERIC_PORT_RATE, RESOURCE_PORT_RATE, SUPPLY_TRADE_RATE } from '../domain/config.js';
import { CatanRuleCodes, VALID, invalid } from '../domain/errors.js';
import {
  RESOURCES,
  countResources,
  hasResources,
  type Resource,
  type ResourceCounts,
} from '../domain/resources.js';
import type { CatanState } from '../domain/state.js';
import { endsOf } from '../domain/topology.js';
import { getTopology } from './placement.rules.js';
import { getPlayer, validateStep } from './turn.rules.js';

/**
 * How many cards of each resource a player gives for one from the supply. A building on either
 * corner of a port's edge gives its rate.
 */
export function getSupplyRates(
  state: Pick<CatanState, 'config' | 'buildings'>,
  playerId: string,
): Record<Resource, number> {
  const topology = getTopology(state);
  const rates = Object.fromEntries(
    RESOURCES.map((resource) => [resource, SUPPLY_TRADE_RATE]),
  ) as Record<Resource, number>;
  const lower = (resource: Resource, rate: number) => {
    rates[resource] = Math.min(rates[resource], rate);
  };

  for (const port of state.config.ports) {
    const reached = endsOf(topology, port.edge).some(
      (vertex) => state.buildings[vertex]?.playerId === playerId,
    );
    if (!reached) continue;
    if (port.type === 'any') RESOURCES.forEach((resource) => lower(resource, GENERIC_PORT_RATE));
    else lower(port.type, RESOURCE_PORT_RATE);
  }
  return rates;
}

export function validateSupplyTrade(
  state: CatanState,
  playerId: string,
  give: Resource,
  receive: Resource,
): GameValidationResult {
  const step = validateStep(state, 'MAIN');
  if (!step.valid) return step;
  if (give === receive) {
    return invalid(CatanRuleCodes.InvalidTrade, 'Trade for a different resource.');
  }
  const rate = getSupplyRates(state, playerId)[give];
  if (getPlayer(state, playerId).resources[give] < rate) {
    return invalid(CatanRuleCodes.CannotAfford, `That trade costs ${rate} ${give}.`);
  }
  if (state.supply[receive] < 1) {
    return invalid(CatanRuleCodes.SupplyShort, `The supply has no ${receive} left.`);
  }
  return VALID;
}

/** Both sides give something, and nothing is traded for itself. */
export function validateProposeTrade(
  state: CatanState,
  playerId: string,
  give: Readonly<Partial<ResourceCounts>>,
  receive: Readonly<Partial<ResourceCounts>>,
): GameValidationResult {
  const step = validateStep(state, 'MAIN');
  if (!step.valid) return step;
  if (countResources(give) === 0 || countResources(receive) === 0) {
    return invalid(CatanRuleCodes.InvalidTrade, 'Both sides of a trade must give something.');
  }
  if (RESOURCES.some((resource) => (give[resource] ?? 0) > 0 && (receive[resource] ?? 0) > 0)) {
    return invalid(CatanRuleCodes.InvalidTrade, 'A resource cannot be traded for itself.');
  }
  if (!hasResources(getPlayer(state, playerId).resources, give)) {
    return invalid(CatanRuleCodes.CannotAfford, 'You do not hold the cards you are offering.');
  }
  return VALID;
}

export function validateRespondTrade(
  state: CatanState,
  playerId: string,
  offerId: number,
  accept: boolean,
): GameValidationResult {
  const { offer, activePlayerId } = state.turn;
  if (!offer || offer.id !== offerId) {
    return invalid(CatanRuleCodes.NoOffer, 'That offer is no longer on the table.');
  }
  if (playerId === activePlayerId) {
    return invalid(CatanRuleCodes.InvalidTrade, 'You cannot answer your own offer.');
  }
  if (offer.responses[playerId] !== undefined) {
    return invalid(CatanRuleCodes.AlreadyResponded, 'You have already answered this offer.');
  }
  if (accept && !hasResources(getPlayer(state, playerId).resources, offer.receive)) {
    return invalid(CatanRuleCodes.CannotAfford, 'You do not hold the cards this offer asks for.');
  }
  return VALID;
}

export function validateConfirmTrade(state: CatanState, partnerId: string): GameValidationResult {
  const { offer } = state.turn;
  if (!offer) return invalid(CatanRuleCodes.NoOffer, 'There is no offer to close.');
  if (offer.responses[partnerId] !== 'accepted') {
    return invalid(CatanRuleCodes.OfferNotAccepted, 'That player has not accepted your offer.');
  }
  return VALID;
}

export function validateCancelTrade(state: CatanState): GameValidationResult {
  if (!state.turn.offer) return invalid(CatanRuleCodes.NoOffer, 'There is no offer to cancel.');
  return VALID;
}

/** The players whose acceptance the active player may close the offer with. */
export function listAccepters(state: Pick<CatanState, 'turn' | 'turnOrder'>): string[] {
  const { offer } = state.turn;
  if (!offer) return [];
  return state.turnOrder.filter((playerId) => offer.responses[playerId] === 'accepted');
}
