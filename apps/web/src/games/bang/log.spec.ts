import type { CardView, LogEntryView } from '@bgp/game-bang';
import { describe, expect, it } from 'vitest';
import { ICON_PATHS } from './art/icons';
import { groupByTurn, logIcon, type EventEntry } from './log';

const card = (kind: CardView['kind']): CardView => ({ id: kind, kind, suit: 'hearts', rank: 9 });
const turn = (id: number, playerId: string): LogEntryView => ({ id, type: 'TURN', playerId });
const play = (id: number, kind: CardView['kind']): EventEntry => ({
  id,
  type: 'PLAY',
  playerId: 'a',
  card: card(kind),
  targetId: null,
});

describe('the log by turn', () => {
  it('is empty for an empty log', () => {
    expect(groupByTurn([])).toEqual([]);
  });

  it('puts each entry under the turn it happened in, in order', () => {
    const turns = groupByTurn([turn(1, 'a'), play(2, 'beer'), play(3, 'bang'), turn(4, 'b')]);
    expect(turns.map((each) => each.turn?.playerId)).toEqual(['a', 'b']);
    expect(turns[0]?.entries.map((entry) => entry.id)).toEqual([2, 3]);
    expect(turns[1]?.entries).toEqual([]);
  });

  it('keeps what was logged before any turn', () => {
    const turns = groupByTurn([play(1, 'beer'), turn(2, 'a')]);
    expect(turns[0]).toEqual({ turn: null, entries: [play(1, 'beer')] });
    expect(turns[1]?.turn?.id).toBe(2);
  });
});

describe('the picture beside an entry', () => {
  const base = { id: 1, playerId: 'a' };
  const entries: EventEntry[] = [
    play(1, 'gatling'),
    { ...base, type: 'RESPONSE', card: card('missed') },
    { ...base, type: 'PICK', card: card('scope') },
    { ...base, type: 'CHECK', reason: 'jail', cards: [], passed: false },
    { ...base, type: 'HIT', amount: 1, sourceId: null },
    { ...base, type: 'DRAW', count: 2, from: 'deck', shown: null },
    { ...base, type: 'TAKE', fromId: 'b', card: null, fromHand: true, discarded: false },
    { ...base, type: 'TAKE', fromId: 'b', card: null, fromHand: true, discarded: true },
    { ...base, type: 'DISCARD', cards: [], reason: 'heal' },
    { ...base, type: 'DISCARD', cards: [], reason: 'penalty' },
    { ...base, type: 'DEATH', role: 'outlaw', killerId: null, lootedById: null },
  ];

  it('is the card an entry is about', () => {
    expect(logIcon(play(1, 'gatling'))).toBe('gatling');
    expect(logIcon(entries[1] as EventEntry)).toBe('missed');
    expect(logIcon(entries[3] as EventEntry)).toBe('jail');
  });

  it('tells a card taken from one made to be discarded', () => {
    expect(logIcon(entries[6] as EventEntry)).toBe('panic');
    expect(logIcon(entries[7] as EventEntry)).toBe('catBalou');
  });

  it('is an outline the game has, for every kind of entry', () => {
    for (const entry of entries) {
      expect(ICON_PATHS[logIcon(entry)]).toMatch(/^M/);
    }
  });
});
