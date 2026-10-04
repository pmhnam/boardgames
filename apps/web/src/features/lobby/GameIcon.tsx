import type { CSSProperties } from 'react';
import { getGameUi } from '../../games/registry';

/** The stylesheet reads the hue from here and picks the shades itself. */
export function gameHueStyle(hue: number | undefined): CSSProperties | undefined {
  return hue === undefined ? undefined : ({ '--game-hue': hue } as CSSProperties);
}

/** What stands for a game with no card of its own: its initial. */
export function gameInitial(displayName: string): string {
  return displayName.trim().charAt(0).toUpperCase();
}

/** A game's emoji on its colour. Decoration: the game's name is always written beside it. */
export function GameIcon({ gameType, displayName }: { gameType: string; displayName: string }) {
  const card = getGameUi(gameType)?.card;
  return (
    <span
      className={card ? 'game-icon tinted' : 'game-icon'}
      style={gameHueStyle(card?.hue)}
      aria-hidden="true"
    >
      {card?.icon ?? gameInitial(displayName)}
    </span>
  );
}
