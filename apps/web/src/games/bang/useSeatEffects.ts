import type { LogEntryView } from '@bgp/game-bang';
import { useEffect, useState } from 'react';
import { entriesAfter, lastLogId, seatEffects, type SeatEffect } from './effects';

/** How long a seat shows what just happened to it. */
const SHOWN_MS = 1500;

const NOTHING: Record<string, SeatEffect> = Object.freeze({});

/**
 * What just happened at each seat, read off the entries the log has gained since the last
 * state. Nothing is shown for what was already there when the table opened, or when a replay
 * steps back.
 */
export function useSeatEffects(log: LogEntryView[]): Record<string, SeatEffect> {
  // The log only ever changes by gaining or losing entries, which its last id tells.
  const lastId = lastLogId(log);
  const [shown, setShown] = useState({ seenId: lastId, effects: NOTHING });

  // Worked out while the new state is drawn, so what happened is on the seat in the same
  // frame as the state it happened in.
  let current = shown;
  if (lastId !== shown.seenId) {
    const fresh = lastId > shown.seenId ? seatEffects(entriesAfter(log, shown.seenId)) : NOTHING;
    // News that touches no seat leaves what is showing to run its time.
    const quiet = lastId > shown.seenId && Object.keys(fresh).length === 0;
    current = { seenId: lastId, effects: quiet ? shown.effects : fresh };
    setShown(current);
  }

  const { effects } = current;
  useEffect(() => {
    if (effects === NOTHING) return;
    const timer = window.setTimeout(
      () => setShown((now) => (now.effects === effects ? { ...now, effects: NOTHING } : now)),
      SHOWN_MS,
    );
    return () => window.clearTimeout(timer);
  }, [effects]);

  return effects;
}
