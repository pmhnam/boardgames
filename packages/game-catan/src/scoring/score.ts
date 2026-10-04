import {
  CITY_POINTS,
  LARGEST_ARMY_POINTS,
  LONGEST_ROAD_POINTS,
  SETTLEMENT_POINTS,
} from '../domain/config.js';
import type { CatanState } from '../domain/state.js';

type Scored = Pick<
  CatanState,
  'buildings' | 'players' | 'longestRoadPlayerId' | 'largestArmyPlayerId'
>;

/** What everyone can count from the table: buildings and the two special cards. */
export function getPublicPoints(state: Scored, playerId: string): number {
  const fromBuildings = Object.values(state.buildings)
    .filter((building) => building.playerId === playerId)
    .reduce(
      (sum, building) => sum + (building.kind === 'city' ? CITY_POINTS : SETTLEMENT_POINTS),
      0,
    );
  return (
    fromBuildings +
    (state.longestRoadPlayerId === playerId ? LONGEST_ROAD_POINTS : 0) +
    (state.largestArmyPlayerId === playerId ? LARGEST_ARMY_POINTS : 0)
  );
}

export function getVictoryPointCards(state: Pick<CatanState, 'players'>, playerId: string): number {
  const held = state.players[playerId]?.developmentCards ?? [];
  return held.filter((card) => card.type === 'victoryPoint').length;
}

/** The full score, hidden Victory Point cards included. */
export function getPoints(state: Scored, playerId: string): number {
  return getPublicPoints(state, playerId) + getVictoryPointCards(state, playerId);
}

export function calculateScores(
  state: Scored & Pick<CatanState, 'turnOrder'>,
): Record<string, number> {
  return Object.fromEntries(
    state.turnOrder.map((playerId) => [playerId, getPoints(state, playerId)]),
  );
}

/**
 * Who holds Largest Army once a player has played a knight: they take it when they have enough
 * knights and more than the holder.
 */
export function resolveLargestArmy(
  state: Pick<CatanState, 'config' | 'players' | 'largestArmyPlayerId'>,
  playerId: string,
): string | null {
  const holder = state.largestArmyPlayerId;
  const knights = state.players[playerId]?.knightsPlayed ?? 0;
  if (knights < state.config.largestArmyMinimum) return holder;
  const toBeat = holder === null ? 0 : (state.players[holder]?.knightsPlayed ?? 0);
  return knights > toBeat ? playerId : holder;
}
