import type { LogEntryView } from '@bgp/game-bang';
import { useEffect, useRef, useState } from 'react';
import { entriesAfter, lastLogId, seatEffects, type SeatEffect } from './effects';

/** How long a seat shows what just happened to it. */
const SHOWN_MS = 1500;

/**
 * What just happened at each seat, read off the entries the log has gained since the last
 * state. Nothing is shown for what was already there when the table opened, or when a replay
 * steps back.
 */
export function useSeatEffects(log: LogEntryView[]): Record<string, SeatEffect> {
  const lastId = lastLogId(log);
  const seen = useRef(lastId);
  const timer = useRef<number | undefined>(undefined);
  const [effects, setEffects] = useState<Record<string, SeatEffect>>({});

  useEffect(() => {
    const fresh = lastId > seen.current ? seatEffects(entriesAfter(log, seen.current)) : {};
    const wentBack = lastId < seen.current;
    seen.current = lastId;
    if (Object.keys(fresh).length === 0 && !wentBack) return;
    window.clearTimeout(timer.current);
    setEffects(fresh);
    timer.current = window.setTimeout(() => setEffects({}), SHOWN_MS);
    // The log only ever changes by gaining or losing entries, which its last id tells.
  }, [lastId]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return effects;
}
