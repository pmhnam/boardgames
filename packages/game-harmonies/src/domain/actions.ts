import type { Hex } from './hex.js';
import type { TokenColor } from './tokens.js';

export interface TakeTokensAction {
  type: 'TAKE_TOKENS';
  spaceIndex: number;
}

export interface PlaceTokenAction {
  type: 'PLACE_TOKEN';
  color: TokenColor;
  cell: Hex;
}

export interface TakeCardAction {
  type: 'TAKE_CARD';
  cardId: string;
}

export interface PlaceCubeAction {
  type: 'PLACE_CUBE';
  cardId: string;
  cell: Hex;
}

export interface EndTurnAction {
  type: 'END_TURN';
}

export type HarmoniesAction =
  TakeTokensAction | PlaceTokenAction | TakeCardAction | PlaceCubeAction | EndTurnAction;
