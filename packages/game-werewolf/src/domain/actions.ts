/** Night one: cupid names the two lovers. */
export interface CupidLinkAction {
  type: 'CUPID_LINK';
  firstId: string;
  secondId: string;
}

/** A werewolf's say in who the pack attacks tonight. */
export interface WolfVoteAction {
  type: 'WOLF_VOTE';
  targetId: string;
}

export interface SeerInspectAction {
  type: 'SEER_INSPECT';
  targetId: string;
}

export interface GuardProtectAction {
  type: 'GUARD_PROTECT';
  targetId: string;
}

/** What everyone with nothing to do at night sends, so that every living player sends something. */
export interface SleepAction {
  type: 'SLEEP';
}

export interface WitchDecideAction {
  type: 'WITCH_DECIDE';
  /** Save tonight's victim. */
  heal: boolean;
  poisonTargetId: string | null;
}

/** Done talking: a majority of the living saying so opens the vote. */
export interface ReadyToVoteAction {
  type: 'READY_TO_VOTE';
}

export interface CastVoteAction {
  type: 'CAST_VOTE';
  /** Null votes to execute nobody. */
  targetId: string | null;
}

export interface HunterShootAction {
  type: 'HUNTER_SHOOT';
  /** Null holds fire. */
  targetId: string | null;
}

export type WerewolfAction =
  | CupidLinkAction
  | WolfVoteAction
  | SeerInspectAction
  | GuardProtectAction
  | SleepAction
  | WitchDecideAction
  | ReadyToVoteAction
  | CastVoteAction
  | HunterShootAction;

export type WerewolfActionType = WerewolfAction['type'];
