import type { GameValidationResult } from '@bgp/game-core';
import { CatanRuleCodes, VALID, invalid } from '../domain/errors.js';
import {
  RESOURCES,
  countResources,
  hasResources,
  type ResourceCounts,
} from '../domain/resources.js';
import type { CatanState } from '../domain/state.js';
import { cornersOf } from '../domain/topology.js';
import { getTopology } from './placement.rules.js';
import { getPlayer } from './turn.rules.js';

/** Half of a hand over the limit, rounded down. */
export function getDiscardOwed(cardCount: number, discardLimit: number): number {
  return cardCount > discardLimit ? Math.floor(cardCount / 2) : 0;
}

/** Who owes cards to a 7, and how many. Players who owe nothing are left out. */
export function getDiscardsOwed(
  state: Pick<CatanState, 'config' | 'players' | 'turnOrder'>,
): Record<string, number> {
  const owed: Record<string, number> = {};
  for (const playerId of state.turnOrder) {
    const count = getDiscardOwed(
      countResources(getPlayer(state, playerId).resources),
      state.config.discardLimit,
    );
    if (count > 0) owed[playerId] = count;
  }
  return owed;
}

export function validateDiscard(
  state: CatanState,
  playerId: string,
  discarded: Readonly<Partial<ResourceCounts>>,
): GameValidationResult {
  const owed = state.turn.step === 'DISCARD' ? (state.turn.pendingDiscards[playerId] ?? 0) : 0;
  if (owed === 0) {
    return invalid(CatanRuleCodes.NothingToDiscard, 'You have nothing to discard.');
  }
  if (countResources(discarded) !== owed) {
    return invalid(CatanRuleCodes.InvalidDiscard, `Discard exactly ${owed} cards.`);
  }
  if (!hasResources(getPlayer(state, playerId).resources, discarded)) {
    return invalid(CatanRuleCodes.InvalidDiscard, 'You do not hold those cards.');
  }
  return VALID;
}

/** The robber must leave the hex it is on. */
export function listRobberHexes(state: Pick<CatanState, 'config' | 'robber'>): string[] {
  return getTopology(state).hexes.filter((hex) => hex !== state.robber);
}

/** The other players with a building on a hex and at least one card to lose. */
export function getRobberVictims(
  state: Pick<CatanState, 'config' | 'buildings' | 'players'>,
  playerId: string,
  hex: string,
): string[] {
  const owners = new Set<string>();
  for (const vertex of cornersOf(getTopology(state), hex)) {
    const building = state.buildings[vertex];
    if (!building || building.playerId === playerId) continue;
    if (countResources(getPlayer(state, building.playerId).resources) > 0) {
      owners.add(building.playerId);
    }
  }
  return [...owners].sort();
}

export function validateMoveRobber(
  state: CatanState,
  playerId: string,
  hex: string,
  victimId: string | undefined,
): GameValidationResult {
  if (!getTopology(state).hexVertices[hex]) {
    return invalid(CatanRuleCodes.InvalidHex, 'That is not a hex of the board.');
  }
  if (hex === state.robber) {
    return invalid(CatanRuleCodes.RobberMustMove, 'The robber must move to another hex.');
  }
  const victims = getRobberVictims(state, playerId, hex);
  if (victims.length === 0) {
    return victimId === undefined
      ? VALID
      : invalid(CatanRuleCodes.InvalidVictim, 'There is nobody to rob on that hex.');
  }
  if (victimId === undefined || !victims.includes(victimId)) {
    return invalid(CatanRuleCodes.InvalidVictim, 'Choose a player on that hex to rob.');
  }
  return VALID;
}

/** A hand as a list of single cards, so one can be drawn from it at random. */
export function listCards(hand: Readonly<ResourceCounts>) {
  return RESOURCES.flatMap((resource) => Array.from({ length: hand[resource] }, () => resource));
}
