import { TOKEN_COLORS, type TokenColor, type TokenCounts } from '@bgp/game-splendor';
import { useState } from 'react';
import { TOKEN_LABEL } from '../layout';
import { GemToken } from './GemToken';

/**
 * Over the limit: the player says which tokens go back. How many is the engine's call. The
 * choice only makes sense for the state it was made in, so this is mounted anew for each one.
 */
export function ReturnPrompt({
  tokens,
  mustReturn,
  canAct,
  busy,
  onReturn,
}: {
  /** What the player holds. */
  tokens: TokenCounts;
  mustReturn: number;
  /** False while an action is in flight: the prompt stays, its buttons wait. */
  canAct: boolean;
  busy?: boolean;
  onReturn(tokens: Partial<TokenCounts>): void;
}) {
  const [returning, setReturning] = useState<Partial<TokenCounts>>({});
  const returnCount = TOKEN_COLORS.reduce((sum, color) => sum + (returning[color] ?? 0), 0);
  const giveBack = (color: TokenColor, delta: 1 | -1) =>
    setReturning((current) => ({ ...current, [color]: (current[color] ?? 0) + delta }));

  return (
    <section className="card splendor-prompt">
      <h2>
        Give back {mustReturn} {mustReturn === 1 ? 'token' : 'tokens'}
      </h2>
      <p className="muted splendor-hint">You may keep 10 at most. Pick the ones to return.</p>
      <div className="row wrap">
        {TOKEN_COLORS.filter((color) => tokens[color] > 0).map((color) => {
          const given = returning[color] ?? 0;
          return (
            <span key={color} className="splendor-stepper">
              <button
                type="button"
                className="secondary"
                aria-label={`Keep one more ${TOKEN_LABEL[color]}`}
                disabled={!canAct || given === 0}
                onClick={() => giveBack(color, -1)}
              >
                −
              </button>
              <GemToken color={color} count={given} />
              <span className="muted">of {tokens[color]}</span>
              <button
                type="button"
                className="secondary"
                aria-label={`Return one ${TOKEN_LABEL[color]}`}
                disabled={!canAct || given >= tokens[color] || returnCount >= mustReturn}
                onClick={() => giveBack(color, 1)}
              >
                +
              </button>
            </span>
          );
        })}
        <button
          type="button"
          disabled={!canAct || returnCount !== mustReturn}
          aria-busy={busy || undefined}
          onClick={() => onReturn(returning)}
        >
          Return {returnCount}/{mustReturn}
        </button>
      </div>
    </section>
  );
}
