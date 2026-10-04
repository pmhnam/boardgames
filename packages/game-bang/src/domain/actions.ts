/** Play a card from the hand, on one's own turn. */
export interface PlayCardAction {
  type: 'PLAY_CARD';
  cardId: string;
  /** Who it is aimed at, for the cards that are aimed. */
  targetId: string | null;
  /**
   * For a Panic! or a Cat Balou: the card on the table to take. Null takes one from the
   * target's hand, unseen.
   */
  targetCardId: string | null;
}

/** End the turn, discarding down to the hand limit. */
export interface EndTurnAction {
  type: 'END_TURN';
  discardIds: string[];
}

/** Answer a BANG!, a duel or the Indians with a card, or with null take what is coming. */
export interface RespondAction {
  type: 'RESPOND';
  cardId: string | null;
}

/** Take from the cards on offer: one at the General Store, two for Kit Carlson. */
export interface PickCardsAction {
  type: 'PICK_CARDS';
  cardIds: string[];
}

/** Where the first card of the turn comes from, for the characters with a choice. */
export interface DrawAction {
  type: 'DRAW';
  source: 'deck' | 'discard' | 'player';
  /** Whose hand, when the source is a player. */
  targetId: string | null;
}

/** Sid Ketchum's ability: two cards for a life point. */
export interface DiscardToHealAction {
  type: 'DISCARD_TO_HEAL';
  cardIds: string[];
}

export type BangAction =
  | PlayCardAction
  | EndTurnAction
  | RespondAction
  | PickCardsAction
  | DrawAction
  | DiscardToHealAction;

export type BangActionType = BangAction['type'];
