import type { SeededRandom } from '../random/seeded-random.js';
import type { PlayerId } from './ids.js';

export const BOT_LEVELS = ['easy', 'normal', 'hard'] as const;

export type BotLevel = (typeof BOT_LEVELS)[number];

export interface BotDecisionInput<TView> {
  /**
   * Exactly what `engine.getPublicView` gives this seat. A bot never sees the raw state, so it
   * knows nothing a human in the same seat would not.
   */
  view: TView;
  playerId: PlayerId;
  level: BotLevel;
  /** The only source of randomness a bot may use. */
  random: SeededRandom;
}

/**
 * A game's computer player. Pure and deterministic: the same input gives the same action.
 * It returns one action at a time and is asked again for as long as it is its turn; the action
 * then goes through the same validation as a human's.
 */
export interface BotStrategy<TView, TAction> {
  chooseAction(input: BotDecisionInput<TView>): TAction;
}
