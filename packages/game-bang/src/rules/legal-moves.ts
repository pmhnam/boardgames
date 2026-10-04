import type { BangState, Pending } from '../domain/state.js';
import { checkPlay, getAnswers } from './play.rules.js';
import { getOthersFrom, getOwingPlayerId, getPlayer } from './players.js';

/** What the match is waiting on a player for: their turn, or the frame they must settle. */
export type Prompt = 'PLAY' | Pending['type'];

export interface PlayOption {
  cardId: string;
  /** Who the card may be played on; null for a card that is not aimed. */
  targets: string[] | null;
}

/** What one player may do right now. The validator, the views and the bots all read this. */
export interface LegalMoves {
  /** Null when the match is not waiting on this player. */
  prompt: Prompt | null;
  /** On their turn: the cards in hand that can be played. */
  plays: PlayOption[];
  /** On their turn: how many cards ending it now would have them discard. */
  discardCount: number;
  /** The cards in hand that answer what is being asked. */
  responses: string[];
  /** Whether sending no card, and taking the consequence, is allowed. */
  canPass: boolean;
  /** The cards on offer, and how many of them to take. */
  picks: string[];
  pickCount: number;
  /** Where a first card may come from other than the deck. */
  drawFromDiscard: boolean;
  drawFromPlayers: string[];
  /** Whether two cards can be discarded for a life point. */
  canHeal: boolean;
}

const NOTHING: LegalMoves = {
  prompt: null,
  plays: [],
  discardCount: 0,
  responses: [],
  canPass: false,
  picks: [],
  pickCount: 0,
  drawFromDiscard: false,
  drawFromPlayers: [],
  canHeal: false,
};

export function getLegalMoves(state: BangState, playerId: string): LegalMoves {
  if (getOwingPlayerId(state) !== playerId) return NOTHING;
  const player = getPlayer(state, playerId);
  const canHeal =
    player.character === 'sidKetchum' && player.life < player.maxLife && player.hand.length >= 2;

  const frame = state.pending.at(-1);
  if (!frame) {
    return {
      ...NOTHING,
      prompt: 'PLAY',
      plays: player.hand.flatMap((cardId) => {
        const play = checkPlay(state, playerId, cardId);
        return play.ok ? [{ cardId, targets: play.targets }] : [];
      }),
      discardCount: Math.max(0, player.hand.length - player.life),
      canHeal,
    };
  }

  switch (frame.type) {
    case 'BANG':
      return {
        ...NOTHING,
        prompt: 'BANG',
        responses: getAnswers(state, playerId, 'missed'),
        canPass: true,
        canHeal,
      };
    case 'INDIANS':
    case 'DUEL':
      return {
        ...NOTHING,
        prompt: frame.type,
        responses: getAnswers(state, playerId, 'bang'),
        canPass: true,
        canHeal,
      };
    case 'DYING':
      return { ...NOTHING, prompt: 'DYING', canPass: true, canHeal };
    case 'STORE':
      return { ...NOTHING, prompt: 'STORE', picks: [...frame.cardIds], pickCount: 1 };
    case 'KIT':
      return { ...NOTHING, prompt: 'KIT', picks: [...frame.cardIds], pickCount: 2 };
    case 'DRAW':
      return {
        ...NOTHING,
        prompt: 'DRAW',
        drawFromDiscard: player.character === 'pedroRamirez' && state.discard.length > 0,
        drawFromPlayers:
          player.character === 'jesseJones'
            ? getOthersFrom(state, playerId).filter(
                (otherId) => getPlayer(state, otherId).hand.length > 0,
              )
            : [],
      };
  }
}
