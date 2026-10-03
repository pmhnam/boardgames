import type { TokenColor } from '@bgp/game-splendor';
import type { CSSProperties } from 'react';
import { TOKEN_FILL, TOKEN_INK, TOKEN_LABEL } from '../layout';

export function gemStyle(color: TokenColor): CSSProperties {
  return { background: TOKEN_FILL[color], color: TOKEN_INK[color] };
}

/** A round token, or with `bonus` the square of a card's permanent gem. */
export function GemToken({
  color,
  count,
  bonus = false,
  small = false,
}: {
  color: TokenColor;
  count?: number;
  bonus?: boolean;
  small?: boolean;
}) {
  const classes = ['splendor-gem', bonus && 'bonus', small && 'small'].filter(Boolean).join(' ');
  return (
    <span className={classes} style={gemStyle(color)} title={TOKEN_LABEL[color]}>
      {count}
      <span className="sr-only"> {TOKEN_LABEL[color]}</span>
    </span>
  );
}
