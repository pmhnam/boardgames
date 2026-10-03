import type { PlayerBoard } from './board.js';
import type { HarmoniesSetup } from './game-config.js';
import type { TokenColor } from './tokens.js';

export type HarmoniesPhase = 'PLAYING' | 'FINISHED';

export interface HarmoniesTurn {
  number: number;
  activePlayerId: string;
  tokensTaken: boolean;
  /** Tokens taken this turn and not yet placed. */
  hand: TokenColor[];
  cardTaken: boolean;
}

export interface HarmoniesState {
  id: string;
  engineVersion: number;
  phase: HarmoniesPhase;

  /**
   * The map, cards and pouch this match was set up with. Kept in the state so a match in
   * progress is unaffected when the stored configuration changes.
   */
  config: HarmoniesSetup;

  /** Play order. The first entry opened the game. */
  turnOrder: string[];
  turn: HarmoniesTurn;

  /** HIDDEN: draw order. Tokens are drawn from the end. */
  pouch: TokenColor[];
  centralSpaces: TokenColor[][];

  /** HIDDEN: draw order. Cards are drawn from the end. */
  cardDeck: string[];
  cardRiver: string[];

  boards: Record<string, PlayerBoard>;

  /** Once set, the game ends when the current round completes. */
  finalRound: boolean;
  winnerPlayerIds: string[];
}
