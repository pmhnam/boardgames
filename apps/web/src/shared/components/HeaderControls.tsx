import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const HeaderControlsTarget = createContext<HTMLDivElement | null>(null);

/** Keep game controls and their state in the game, while displaying them in the menu. */
export function HeaderControls({ children }: { children: ReactNode }) {
  const target = useContext(HeaderControlsTarget);
  return target ? createPortal(children, target) : null;
}
