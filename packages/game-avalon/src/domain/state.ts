import type { AvalonRules } from './game-config.js';
import type { Role } from './roles.js';

export type AvalonPhase =
  'TEAM_PROPOSAL' | 'TEAM_VOTE' | 'QUEST' | 'LADY' | 'ASSASSINATION' | 'FINISHED';

/** A proposal everyone has voted on. */
export interface Proposal {
  /** Index of the quest it was for. */
  quest: number;
  leaderId: string;
  team: string[];
  votes: Record<string, boolean>;
  approved: boolean;
}

/** A quest every team member has played a card on. */
export interface QuestRecord {
  leaderId: string;
  team: string[];
  /** True for Success. Secret until the game is over: only the number of Fails is announced. */
  cards: Record<string, boolean>;
}

/** The proposal or quest in flight. Votes and cards stay secret until the last one is in. */
export interface InFlight {
  team: string[] | null;
  votes: Record<string, boolean>;
  cards: Record<string, boolean>;
}

export interface LadyInspection {
  holderId: string;
  targetId: string;
}

export interface LadyState {
  holderId: string;
  inspections: LadyInspection[];
}

/**
 * Records keyed by player are never iterated: the database stores state as jsonb, which does
 * not keep key order. Anything ordered walks `seatOrder`.
 *
 * Not stored, because it follows from the rest: the leader, the quest in progress, the run of
 * rejections, what each quest came to, what the Lady showed, and who won.
 */
export interface AvalonState {
  id: string;
  engineVersion: number;
  phase: AvalonPhase;
  rules: AvalonRules;
  seatOrder: string[];
  firstLeaderIndex: number;
  /** Secret. */
  roles: Record<string, Role>;
  proposals: Proposal[];
  quests: QuestRecord[];
  current: InFlight;
  /** Null when the Lady of the Lake is not in play. */
  lady: LadyState | null;
  assassinTargetId: string | null;
}
