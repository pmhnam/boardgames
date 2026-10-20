import { useSyncExternalStore } from 'react';

/** How the table is drawn: the printed artwork, or the plain coloured cards. */
export type ArtStyle = 'image' | 'color';

const KEY = 'splendor-art-style';
const listeners = new Set<() => void>();

function read(): ArtStyle {
  try {
    return localStorage.getItem(KEY) === 'color' ? 'color' : 'image';
  } catch {
    return 'image';
  }
}

let current: ArtStyle = typeof window === 'undefined' ? 'image' : read();

export function setArtStyle(style: ArtStyle): void {
  current = style;
  try {
    localStorage.setItem(KEY, style);
  } catch {
    // Kept for this page only.
  }
  for (const listener of listeners) listener();
}

/** The viewer's choice, kept in this browser and shared by every card on the table. */
export function useArtStyle(): ArtStyle {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => 'image',
  );
}
