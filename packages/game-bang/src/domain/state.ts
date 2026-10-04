import type { Card } from './cards.js';
import type { CharacterId } from './characters.js';
import type { BangSetup } from './game-config.js';
import type { RoleId, Winner } from './roles.js';

export type BangPhase = 'PLAYING' | 'FINISHED';

/**
 * Where the active player is in their turn. Only PLAY ever waits on them: the steps before
 * it resolve by themselves unless a character's ability gives a choice.
 */
export type TurnStep = 'DYNAMITE' | 'JAIL' | 'DRAW' | 'PLAY';

export interface TurnState {
  number: number;
  playerId: string;
  step: TurnStep;
  bangsPlayed: number;
}

export interface PlayerState {
  /** Hidden from everyone else until the player is eliminated. The sheriff's is public. */
  role: RoleId;
  character: CharacterId;
  alive: boolean;
  life: number;
  maxLife: number;
  /** Hidden. Only how many there are is public. */
  hand: string[];
  /** The blue cards in front of the player, for all to see. */
  inPlay: string[];
}

/**
 * A shot going round: at one player for a BANG!, at everyone else in turn for a Gatling.
 * `queue[0]` is who it is on now.
 */
export interface BangPending {
  type: 'BANG';
  sourceId: string;
  queue: string[];
  /** Missed! cards each target owes. */
  perTarget: number;
  /** What the current target still owes, once their barrels have been tried. */
  missedNeeded: number;
  /** Whether the current target's barrels have been tried and the frame is waiting on them. */
  ready: boolean;
}

/** Everyone else in turn discards a BANG! or loses a life point. */
export interface IndiansPending {
  type: 'INDIANS';
  sourceId: string;
  queue: string[];
}

/** `playerId` discards a BANG! or loses the duel; if they do, it is the opponent's go. */
export interface DuelPending {
  type: 'DUEL';
  playerId: string;
  opponentId: string;
}

/** The General Store: `queue[0]` takes one of the cards on offer. */
export interface StorePending {
  type: 'STORE';
  queue: string[];
  cardIds: string[];
}

/** A character choosing where their first card of the turn comes from. */
export interface DrawPending {
  type: 'DRAW';
  playerId: string;
}

/** Kit Carlson keeping two of the three cards looked at. */
export interface KitPending {
  type: 'KIT';
  playerId: string;
  cardIds: string[];
}

/** Sid Ketchum at zero life with the cards to buy it back. */
export interface DyingPending {
  type: 'DYING';
  playerId: string;
  killerId: string | null;
}

export type Pending =
  | BangPending
  | IndiansPending
  | DuelPending
  | StorePending
  | DrawPending
  | KitPending
  | DyingPending;

export type CheckReason = 'barrel' | 'jail' | 'dynamite';
export type DiscardReason = 'limit' | 'heal' | 'penalty';

/** What happened, for the table to follow. Each kind is public unless it says otherwise. */
export type LogEvent =
  | { type: 'TURN'; playerId: string }
  | { type: 'PLAY'; playerId: string; cardId: string; targetId: string | null }
  /** A card discarded to answer a BANG!, a duel or the Indians. */
  | { type: 'RESPONSE'; playerId: string; cardId: string }
  /** A "draw!". `passed` is the outcome the player was hoping for. */
  | { type: 'CHECK'; playerId: string; reason: CheckReason; cardIds: string[]; passed: boolean }
  | { type: 'HIT'; playerId: string; amount: number; sourceId: string | null }
  /** Cards drawn outside the usual two a turn. `shownCardId` is one the table got to see. */
  | {
      type: 'DRAW';
      playerId: string;
      count: number;
      from: 'deck' | 'discard';
      shownCardId: string | null;
    }
  /**
   * A card taken from another player. Taken from a hand and kept, only the two of them know
   * which card it was.
   */
  | {
      type: 'TAKE';
      playerId: string;
      fromId: string;
      cardId: string;
      fromHand: boolean;
      discarded: boolean;
    }
  /** A card taken from the General Store. */
  | { type: 'PICK'; playerId: string; cardId: string }
  | { type: 'DISCARD'; playerId: string; cardIds: string[]; reason: DiscardReason }
  | {
      type: 'DEATH';
      playerId: string;
      role: RoleId;
      killerId: string | null;
      /** Who took the cards they left, if anyone. */
      lootedById: string | null;
    };

export type LogEntry = LogEvent & { id: number };

export interface BangState {
  id: string;
  engineVersion: number;
  phase: BangPhase;
  /** What this match plays by, fixed when it started. */
  setup: BangSetup;
  /** Every card in the match by id. Where each one is, is in the piles below. */
  cards: Record<string, Card>;
  /** Hidden. With `rngCounter`, the source of every shuffle and blind pick after setup. */
  seed: string;
  rngCounter: number;
  seatOrder: string[];
  players: Record<string, PlayerState>;
  /** Hidden. Cards are drawn from the end. */
  deck: string[];
  /** Face up; the last entry is on top. */
  discard: string[];
  turn: TurnState;
  /**
   * What has to be settled before the turn goes on, innermost last: a duel, a Gatling going
   * round, a general store. Empty while the active player is free to play.
   */
  pending: Pending[];
  /** The most recent events only. */
  log: LogEntry[];
  logSeq: number;
  winner: Winner | null;
  winnerPlayerIds: string[];
}
