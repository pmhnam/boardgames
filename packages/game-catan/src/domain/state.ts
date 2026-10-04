import type { Tile } from './default-board.js';
import type { DevelopmentCardType } from './development-cards.js';
import type { CatanSetup } from './game-config.js';
import type { ResourceCounts } from './resources.js';

export type CatanPhase = 'PLAYING' | 'FINISHED';

/**
 * Where the turn stands. The two SETUP steps are the opening, where each player places a
 * settlement and then a road. After that a turn is ROLL, then MAIN; a 7 or a knight puts
 * DISCARD and ROBBER in between.
 */
export type TurnStep = 'SETUP_SETTLEMENT' | 'SETUP_ROAD' | 'ROLL' | 'DISCARD' | 'ROBBER' | 'MAIN';

export type TradeResponse = 'accepted' | 'declined';

/** What the active player offers the table. One offer is open at a time. */
export interface TradeOffer {
  /** Counts the offers of the match. An answer names the offer it is for. */
  id: number;
  give: ResourceCounts;
  receive: ResourceCounts;
  /** Only players who have answered appear here. */
  responses: Record<string, TradeResponse>;
}

export interface CatanTurn {
  /** Counts every turn, the opening's included. */
  number: number;
  activePlayerId: string;
  step: TurnStep;
  /** This turn's dice, once rolled. */
  roll: [number, number] | null;
  developmentCardPlayed: boolean;
  /** Roads still to place for free from a Road Building card. */
  freeRoads: number;
  /** Resource cards each player still owes after a 7. Only players who owe appear here. */
  pendingDiscards: Record<string, number>;
  /** The settlement just placed in the opening: its road must start there. */
  setupVertex: string | null;
  offer: TradeOffer | null;
}

export type BuildingKind = 'settlement' | 'city';

export interface Building {
  playerId: string;
  kind: BuildingKind;
}

export interface HeldDevelopmentCard {
  type: DevelopmentCardType;
  /** A card cannot be played on the turn it was bought. */
  boughtOnTurn: number;
}

/** Points, pieces left and road length are not stored: they follow from the board. */
export interface PlayerState {
  /** Hidden from the other players. */
  resources: ResourceCounts;
  /** Hidden from the other players. Played cards leave; Victory Point cards stay. */
  developmentCards: HeldDevelopmentCard[];
  knightsPlayed: number;
}

/** Where the next random draw comes from. Never leaves the server. */
export interface RandomState {
  seed: string;
  draws: number;
}

export interface CatanState {
  id: string;
  engineVersion: number;
  phase: CatanPhase;
  /** What this match plays by, fixed when it started. */
  config: CatanSetup;
  /** Seat order, rotated so the starting player is first. */
  turnOrder: string[];
  turn: CatanTurn;
  /** The terrain and number on each hex. */
  tiles: Record<string, Tile>;
  /** The hex the robber stands on. */
  robber: string;
  /** Settlements and cities, by corner. */
  buildings: Record<string, Building>;
  /** Who owns the road on each edge. */
  roads: Record<string, string>;
  /** The resource cards nobody holds. */
  supply: ResourceCounts;
  /** Hidden. Cards are drawn from the end. */
  developmentDeck: DevelopmentCardType[];
  players: Record<string, PlayerState>;
  /** Stored because a tie leaves the card with whoever held it first. */
  longestRoutePlayerId: string | null;
  largestArmyPlayerId: string | null;
  /** How many trade offers have been made, so each one gets its own id. */
  offersMade: number;
  random: RandomState;
  winnerPlayerIds: string[];
}
