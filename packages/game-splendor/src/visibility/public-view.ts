import type { GameViewer } from '@bgp/game-core';
import { getCard, getNoble, type DevelopmentCard, type Noble, type Tier } from '../domain/cards.js';
import type { GemCounts, TokenCounts } from '../domain/gems.js';
import type {
  PlayerState,
  ReservedCard,
  SplendorPhase,
  SplendorState,
  SplendorTurn,
} from '../domain/state.js';
import {
  NO_LEGAL_MOVES,
  getLegalMoves,
  getPurchaseSources,
  getWallet,
  getWaitingNobles,
  type LegalMoves,
} from '../rules/legal-moves.js';
import { getShortfall, type CardShortfall } from '../rules/purchase.rules.js';
import { getBonuses, getPoints } from '../scoring/score.js';

/**
 * A reserved card as a viewer sees it. A card taken unseen from a deck shows only its back,
 * i.e. its tier, to everyone but its owner.
 */
export type ReservedView = { hidden: false; card: DevelopmentCard } | { hidden: true; tier: Tier };

export interface PlayerView {
  tokens: TokenCounts;
  bonuses: GemCounts;
  points: number;
  purchased: DevelopmentCard[];
  reserved: ReservedView[];
  nobles: Noble[];
}

export interface SplendorView {
  id: string;
  phase: SplendorPhase;
  turnOrder: string[];
  turn: SplendorTurn;
  targetScore: number;
  bank: TokenCounts;
  /** Face-up cards, four slots per tier. A slot is null once its deck has run out. */
  market: Record<Tier, (DevelopmentCard | null)[]>;
  deckCounts: Record<Tier, number>;
  nobles: Noble[];
  players: Record<string, PlayerView>;
  finalRound: boolean;
  winnerPlayerIds: string[];
  /**
   * How far the viewer is from affording each card they could buy: the face-up ones and their
   * own reserve. There on every turn, so a player can plan; empty for anyone not seated.
   */
  shortfalls: Record<string, CardShortfall>;
  /** What the viewer may do right now. Empty unless it is their turn. */
  legal: LegalMoves;
}

function getReservedView(
  state: SplendorState,
  entry: ReservedCard,
  isOwner: boolean,
): ReservedView {
  const card = getCard(state.config.cards, entry.cardId);
  return entry.blind && !isOwner ? { hidden: true, tier: card.tier } : { hidden: false, card };
}

function getPlayerView(state: SplendorState, player: PlayerState, isOwner: boolean): PlayerView {
  return {
    tokens: { ...player.tokens },
    bonuses: getBonuses(state.config, player.purchased),
    points: getPoints(state.config, player),
    purchased: player.purchased.map((cardId) => getCard(state.config.cards, cardId)),
    reserved: player.reserved.map((entry) => getReservedView(state, entry, isOwner)),
    nobles: player.nobles.map((nobleId) => getNoble(state.config.nobles, nobleId)),
  };
}

function getShortfalls(state: SplendorState, playerId: string): Record<string, CardShortfall> {
  const wallet = getWallet(state, playerId);
  return Object.fromEntries(
    getPurchaseSources(state, playerId).map((cardId) => [
      cardId,
      getShortfall(wallet, getCard(state.config.cards, cardId).cost),
    ]),
  );
}

/**
 * Built field by field: the decks leave as counts, and a card reserved unseen leaves as its
 * tier for everyone but its owner. Spectators and admins see what an opponent would.
 */
export function getPublicView(state: SplendorState, viewer: GameViewer): SplendorView {
  const viewerId = viewer.type === 'player' ? viewer.playerId : null;
  const isActiveViewer = state.phase === 'PLAYING' && state.turn.activePlayerId === viewerId;
  const faceUp = (tier: Tier) =>
    state.market[tier].map((cardId) =>
      cardId === null ? null : getCard(state.config.cards, cardId),
    );

  return {
    id: state.id,
    phase: state.phase,
    turnOrder: [...state.turnOrder],
    turn: {
      number: state.turn.number,
      activePlayerId: state.turn.activePlayerId,
      step: state.turn.step,
    },
    targetScore: state.config.targetScore,
    bank: { ...state.bank },
    market: { 1: faceUp(1), 2: faceUp(2), 3: faceUp(3) },
    deckCounts: { 1: state.decks[1].length, 2: state.decks[2].length, 3: state.decks[3].length },
    nobles: getWaitingNobles(state),
    players: Object.fromEntries(
      state.turnOrder.map((playerId) => {
        const player = state.players[playerId];
        if (!player) throw new Error(`Unknown player ${playerId}`);
        return [playerId, getPlayerView(state, player, playerId === viewerId)];
      }),
    ),
    shortfalls: viewerId !== null && state.players[viewerId] ? getShortfalls(state, viewerId) : {},
    finalRound: state.finalRound,
    winnerPlayerIds: [...state.winnerPlayerIds],
    legal: isActiveViewer && viewerId !== null ? getLegalMoves(state, viewerId) : NO_LEGAL_MOVES,
  };
}
