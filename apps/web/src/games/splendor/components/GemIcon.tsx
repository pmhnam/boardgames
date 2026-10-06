import type { TokenColor } from '@bgp/game-splendor';

/** One outline per colour, so a gem can be told apart by shape as well as by colour. */
const SHAPE: Record<TokenColor, string> = {
  white: 'M12 2 21 12 12 22 3 12Z',
  blue: 'M12 2C12 2 20 11 20 15a8 8 0 0 1-16 0C4 11 12 2 12 2Z',
  green: 'M12 2 20.5 7v10L12 22 3.5 17V7Z',
  red: 'M8 2h8l6 6v8l-6 6H8l-6-6V8Z',
  black: 'M12 2 22 9.5 18 21H6L2 9.5Z',
  gold: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z',
};

/** Drawn in the current text colour; the token or card behind it supplies the gem's own colour. */
export function GemIcon({ color }: { color: TokenColor }) {
  return (
    <svg className="splendor-gem-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={SHAPE[color]} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}
