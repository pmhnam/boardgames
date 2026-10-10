import type { TokenColor } from '@bgp/game-harmonies';
import { useHarmoniesText } from '../useHarmoniesText';
import { TokenStack } from './TokenStack';

/** One token, drawn as it looks on the table. */
export function TokenChip({ color }: { color: TokenColor }) {
  const label = useHarmoniesText().token[color];
  return (
    <span className="token-chip" title={label}>
      <svg viewBox="-11.5 -11.5 23 23" aria-hidden="true">
        <TokenStack x={0} y={0} size={10.5} stack={[color]} />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
