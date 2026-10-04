/** The leader names who goes on the quest. */
export interface ProposeTeamAction {
  type: 'PROPOSE_TEAM';
  team: string[];
}

/**
 * Everyone votes at once, so a vote names the proposal it is for: one that arrives late is
 * refused instead of counting towards the next team.
 */
export interface VoteAction {
  type: 'VOTE';
  /** How many proposals were settled before this one. */
  proposal: number;
  approve: boolean;
}

/** The secret choice sits in the payload: action types are shown next to names in a replay. */
export interface PlayQuestCardAction {
  type: 'PLAY_QUEST_CARD';
  /** How many quests were completed before this one. */
  quest: number;
  success: boolean;
}

export interface UseLadyAction {
  type: 'USE_LADY';
  targetId: string;
}

export interface AssassinateAction {
  type: 'ASSASSINATE';
  targetId: string;
}

export type AvalonAction =
  ProposeTeamAction | VoteAction | PlayQuestCardAction | UseLadyAction | AssassinateAction;
