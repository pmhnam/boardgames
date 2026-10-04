import type { Resource, ResourceCounts } from './resources.js';

/** The opening: a settlement on any free corner. */
export interface PlaceSetupSettlementAction {
  type: 'PLACE_SETUP_SETTLEMENT';
  vertex: string;
}

/** The opening: a road from the settlement just placed. */
export interface PlaceSetupRoadAction {
  type: 'PLACE_SETUP_ROAD';
  edge: string;
}

/** The payload never carries the result: the engine rolls. */
export interface RollDiceAction {
  type: 'ROLL_DICE';
}

/** Give up half of a hand that a 7 found too large. Any player who owes may send it. */
export interface DiscardAction {
  type: 'DISCARD';
  resources: Partial<ResourceCounts>;
}

/** Move the robber and, if anyone with cards has a building there, rob one of them. */
export interface MoveRobberAction {
  type: 'MOVE_ROBBER';
  hex: string;
  victimId?: string;
}

/** Paid for, or free while a Road Building card is being resolved. */
export interface BuildRoadAction {
  type: 'BUILD_ROAD';
  edge: string;
}

export interface BuildSettlementAction {
  type: 'BUILD_SETTLEMENT';
  vertex: string;
}

export interface BuildCityAction {
  type: 'BUILD_CITY';
  vertex: string;
}

export interface BuyDevelopmentCardAction {
  type: 'BUY_DEVELOPMENT_CARD';
}

export interface PlayKnightAction {
  type: 'PLAY_KNIGHT';
}

export interface PlayRoadBuildingAction {
  type: 'PLAY_ROAD_BUILDING';
}

export interface PlayYearOfPlentyAction {
  type: 'PLAY_YEAR_OF_PLENTY';
  resources: Resource[];
}

export interface PlayMonopolyAction {
  type: 'PLAY_MONOPOLY';
  resource: Resource;
}

/** One card from the supply, paid for at the best rate the player's harbors give. */
export interface SupplyTradeAction {
  type: 'SUPPLY_TRADE';
  give: Resource;
  receive: Resource;
}

/** Offer the other players a trade. */
export interface ProposeTradeAction {
  type: 'PROPOSE_TRADE';
  give: Partial<ResourceCounts>;
  receive: Partial<ResourceCounts>;
}

/** Answer the open offer. Sent by the other players, out of turn. */
export interface RespondTradeAction {
  type: 'RESPOND_TRADE';
  accept: boolean;
}

/** Close the open offer with one of the players who accepted it. */
export interface ConfirmTradeAction {
  type: 'CONFIRM_TRADE';
  playerId: string;
}

export interface CancelTradeAction {
  type: 'CANCEL_TRADE';
}

export interface EndTurnAction {
  type: 'END_TURN';
}

export type CatanAction =
  | PlaceSetupSettlementAction
  | PlaceSetupRoadAction
  | RollDiceAction
  | DiscardAction
  | MoveRobberAction
  | BuildRoadAction
  | BuildSettlementAction
  | BuildCityAction
  | BuyDevelopmentCardAction
  | PlayKnightAction
  | PlayRoadBuildingAction
  | PlayYearOfPlentyAction
  | PlayMonopolyAction
  | SupplyTradeAction
  | ProposeTradeAction
  | RespondTradeAction
  | ConfirmTradeAction
  | CancelTradeAction
  | EndTurnAction;
