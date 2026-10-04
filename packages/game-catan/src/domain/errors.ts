import { CommonRuleCodes, type GameValidationResult } from '@bgp/game-core';

export const CatanRuleCodes = {
  ...CommonRuleCodes,
  WrongStep: 'WRONG_STEP',
  InvalidVertex: 'INVALID_VERTEX',
  InvalidEdge: 'INVALID_EDGE',
  InvalidHex: 'INVALID_HEX',
  VertexOccupied: 'VERTEX_OCCUPIED',
  TooClose: 'TOO_CLOSE',
  EdgeOccupied: 'EDGE_OCCUPIED',
  NotConnected: 'NOT_CONNECTED',
  NotYourSettlement: 'NOT_YOUR_SETTLEMENT',
  NoPiecesLeft: 'NO_PIECES_LEFT',
  CannotAfford: 'CANNOT_AFFORD',
  RoadsPending: 'ROADS_PENDING',
  InvalidDiscard: 'INVALID_DISCARD',
  NothingToDiscard: 'NOTHING_TO_DISCARD',
  RobberMustMove: 'ROBBER_MUST_MOVE',
  InvalidVictim: 'INVALID_VICTIM',
  DeckEmpty: 'DECK_EMPTY',
  CardNotPlayable: 'CARD_NOT_PLAYABLE',
  SupplyShort: 'SUPPLY_SHORT',
  InvalidTrade: 'INVALID_TRADE',
  OfferPending: 'OFFER_PENDING',
  NoOffer: 'NO_OFFER',
  AlreadyResponded: 'ALREADY_RESPONDED',
  OfferNotAccepted: 'OFFER_NOT_ACCEPTED',
} as const;

export const VALID: GameValidationResult = { valid: true };

export function invalid(code: string, message: string): GameValidationResult {
  return { valid: false, code, message };
}
