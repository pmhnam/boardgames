import type { WerewolfSetup } from './game-config.js';
import type { RoleId } from './roles.js';

export type WerewolfPhase = 'NIGHT' | 'DAY_DISCUSSION' | 'DAY_VOTE' | 'HUNTER_SHOT' | 'FINISHED';

/** A night runs through these in order, skipping the ones nobody has anything to do in. */
export type NightStep = 'CUPID' | 'MAIN' | 'WITCH';

export type Winner = 'village' | 'werewolves' | 'lovers' | 'nobody';

/** What a seer learned about one player. */
export interface Inspection {
  round: number;
  targetId: string;
  isWolf: boolean;
}

export interface PlayerState {
  /** Hidden from everyone else until revealed. */
  role: RoleId;
  alive: boolean;
  /** False once the village has voted out the idiot and found them out. */
  canVote: boolean;
  /** Shown to everyone: on death when the room plays with reveals, and the spared idiot's. */
  roleRevealed: boolean;
  /** Werewolf attacks this player still shrugs off. Only an elder starts with any. */
  extraLives: number;
  /** A witch's potions. */
  healUsed: boolean;
  poisonUsed: boolean;
  /** Who a bodyguard watched last, and so may not watch tonight. */
  lastProtectedId: string | null;
  /** What a seer has learned. Hidden. */
  inspections: Inspection[];
}

/** Everything about a night in progress is hidden, down to who has acted. */
export interface NightState {
  step: NightStep;
  /** Who has done what the current step asked of them. */
  acted: string[];
  /** Werewolf to the player they want attacked. */
  wolfVotes: Record<string, string>;
  /** Bodyguard to the player they watch tonight. */
  protections: Record<string, string>;
  /** The pack's victim, settled when the main step closes. Null on a tied vote. */
  attackedId: string | null;
  healed: boolean;
  /** Witch to the player they poisoned. */
  poisons: Record<string, string>;
}

export interface DayState {
  /** Who is done talking. */
  ready: string[];
  /** Voter to their choice; null is a vote to execute nobody. Hidden until all are in. */
  votes: Record<string, string | null>;
}

/** What everyone at the table is told. */
export type LogEntry =
  | { type: 'NIGHT'; round: number; deaths: string[] }
  | {
      type: 'VOTE';
      round: number;
      votes: Array<{ voterId: string; targetId: string | null }>;
      executedId: string | null;
      /** The village picked the idiot, who lives on without a vote. */
      spared: boolean;
      /** The village executed an elder and its special roles lost their powers. */
      powersLost: boolean;
      deaths: string[];
    }
  | { type: 'SHOT'; round: number; hunterId: string; targetId: string | null; deaths: string[] };

export interface WerewolfState {
  id: string;
  engineVersion: number;
  setup: WerewolfSetup;
  seatOrder: string[];
  players: Record<string, PlayerState>;
  /** Hidden from all but the two of them and cupid. */
  lovers: [string, string] | null;
  /** Set when the village executes an elder. */
  powersLost: boolean;
  /** Night N is followed by day N. */
  round: number;
  phase: WerewolfPhase;
  night: NightState | null;
  day: DayState | null;
  /** Dead hunters who have yet to fire, in the order they died. */
  pendingHunters: string[];
  /** Where the match goes once they have. */
  afterShots: 'DAY_DISCUSSION' | 'NIGHT' | null;
  log: LogEntry[];
  winner: Winner | null;
  winnerPlayerIds: string[];
}
