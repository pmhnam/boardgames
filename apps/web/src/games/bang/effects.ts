import type { LogEntryView } from '@bgp/game-bang';

/** What just happened to a player, shown on their seat for a moment. */
export type SeatEffectKind = 'answer' | 'hit' | 'blast' | 'death';

export interface SeatEffect {
  /** The log entry it came from: a new one restarts the animation. */
  id: number;
  kind: SeatEffectKind;
  /** Life points lost, for a hit or a blast. */
  amount: number;
}

/** When several things happen to a player at once, the gravest is the one shown. */
const WEIGHT: Record<SeatEffectKind, number> = { answer: 0, hit: 1, blast: 2, death: 3 };

export function lastLogId(log: LogEntryView[]): number {
  return log.at(-1)?.id ?? 0;
}

/** The entries the table has not shown yet. */
export function entriesAfter(log: LogEntryView[], seenId: number): LogEntryView[] {
  return log.filter((entry) => entry.id > seenId);
}

function effectOf(entry: LogEntryView, blown: boolean): SeatEffect | null {
  const { id } = entry;
  switch (entry.type) {
    case 'RESPONSE':
      return { id, kind: 'answer', amount: 0 };
    case 'CHECK':
      return entry.reason === 'barrel' && entry.passed ? { id, kind: 'answer', amount: 0 } : null;
    case 'HIT':
      return { id, kind: blown ? 'blast' : 'hit', amount: entry.amount };
    case 'DEATH':
      return { id, kind: 'death', amount: 0 };
    default:
      return null;
  }
}

/** What to show on each seat for a run of new log entries, keyed by player. */
export function seatEffects(entries: LogEntryView[]): Record<string, SeatEffect> {
  const effects: Record<string, SeatEffect> = {};
  // A dynamite that goes off is logged as a failed flip, then as the life it costs.
  let blownId: string | null = null;
  for (const entry of entries) {
    const blown = entry.type === 'HIT' && entry.playerId === blownId;
    blownId =
      entry.type === 'CHECK' && entry.reason === 'dynamite' && !entry.passed
        ? entry.playerId
        : null;
    const effect = effectOf(entry, blown);
    const current = effects[entry.playerId];
    if (effect && (!current || WEIGHT[effect.kind] >= WEIGHT[current.kind])) {
      effects[entry.playerId] = effect;
    }
  }
  return effects;
}
