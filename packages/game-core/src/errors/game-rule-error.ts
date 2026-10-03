/** Rule codes every turn-based game shares. Game-specific codes live in the game package. */
export const CommonRuleCodes = {
  NotYourTurn: 'NOT_YOUR_TURN',
  GameNotPlaying: 'GAME_NOT_PLAYING',
} as const;

export class GameRuleError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'GameRuleError';
  }
}
