import type { ReactNode } from 'react';
import type { Hint } from '../hints';

/** A hint laid out: its title, then whatever the caller adds (a cost), its body and advice. */
export function HintText({ hint, children }: { hint: Hint; children?: ReactNode }) {
  return (
    <>
      {hint.title && <strong>{hint.title}</strong>}
      {children}
      <span>{hint.body}</span>
      {hint.advice && <span className="muted">{hint.advice}</span>}
    </>
  );
}
