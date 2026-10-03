import type { TokenColor } from '@bgp/game-harmonies';
import { TOKEN_FILL, TOKEN_LABEL } from '../layout';

export function TokenChip({ color }: { color: TokenColor }) {
  return (
    <span
      className="token-chip"
      style={{ background: TOKEN_FILL[color] }}
      title={TOKEN_LABEL[color]}
    >
      <span className="sr-only">{TOKEN_LABEL[color]}</span>
    </span>
  );
}
