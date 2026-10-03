import type { Tier } from './cards.js';
import type { SplendorSetup } from './game-config.js';
import type { TokenCounts } from './gems.js';

export type SplendorPhase = 'PLAYING' | 'FINISHED';

/**
 * Where the active player is in their turn. Most turns are a single ACTION; the other steps
 * only happen when that action leaves them over the token limit or with a choice of nobles.
 */
export type TurnStep = 'ACTION' | 'RETURN_GEMS' | 'CHOOSE_NOBLE';

export interface SplendorTurn {
  number: number;
  activePlayerId: string;
  step: TurnStep;
}

export interface ReservedCard {
  cardId: string;
  /** Taken unseen from a deck: only its owner knows what it is. */
  blind: boolean;
}

/** Points and bonuses are not stored: they follow from the cards and nobles held. */
export interface PlayerState {
  tokens: TokenCounts;
  purchased: string[];
  reserved: ReservedCard[];
  nobles: string[];
}

export interface SplendorState {
  id: string;
  engineVersion: number;
  phase: SplendorPhase;
  /** What this match plays by, fixed when it started. */
  config: SplendorSetup;
  /** Seat order, rotated so the starting player is first. A round ends with the last entry. */
  turnOrder: string[];
  turn: SplendorTurn;
  bank: TokenCounts;
  /** Hidden. Cards are drawn from the end. */
  decks: Record<Tier, string[]>;
  /** Face-up cards. A slot stays null once its deck has run out. */
  market: Record<Tier, (string | null)[]>;
  /** Nobles still waiting to visit someone. */
  nobles: string[];
  players: Record<string, PlayerState>;
  /** Consecutive forced passes. A whole round of them ends the game: nothing can change. */
  passStreak: number;
  finalRound: boolean;
  winnerPlayerIds: string[];
}
