import type { LogEntryView } from '@bgp/game-bang';
import type { IconName } from './art/icons';

export type TurnEntry = Extract<LogEntryView, { type: 'TURN' }>;
export type EventEntry = Exclude<LogEntryView, { type: 'TURN' }>;

/** What happened in one turn, in the order it happened. */
export interface LogTurn {
  /** The entry that opened the turn; null for anything logged before the first one. */
  turn: TurnEntry | null;
  entries: EventEntry[];
}

export function groupByTurn(log: LogEntryView[]): LogTurn[] {
  const turns: LogTurn[] = [];
  for (const entry of log) {
    if (entry.type === 'TURN') {
      turns.push({ turn: entry, entries: [] });
      continue;
    }
    if (turns.length === 0) turns.push({ turn: null, entries: [] });
    turns.at(-1)?.entries.push(entry);
  }
  return turns;
}

/** The picture beside an entry: the card it is about where there is one. */
export function logIcon(entry: EventEntry): IconName {
  switch (entry.type) {
    case 'PLAY':
    case 'RESPONSE':
    case 'PICK':
      return entry.card.kind;
    case 'CHECK':
      return entry.reason;
    case 'HIT':
      return 'bullet';
    case 'DRAW':
      return 'deck';
    case 'TAKE':
      return entry.discarded ? 'catBalou' : 'panic';
    case 'DISCARD':
      return entry.reason === 'heal' ? 'sidKetchum' : 'catBalou';
    case 'DEATH':
      return 'skull';
  }
}
