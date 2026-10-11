import type { CardView, LogEntryView } from '@bgp/game-bang';
import { describe, expect, it } from 'vitest';
import { entriesAfter, lastLogId, seatEffects } from './effects';

const card = (kind: CardView['kind']): CardView => ({ id: kind, kind, suit: 'spades', rank: 5 });

const play: LogEntryView = {
  id: 1,
  type: 'PLAY',
  playerId: 'a',
  card: card('bang'),
  targetId: 'b',
};
const missed: LogEntryView = { id: 2, type: 'RESPONSE', playerId: 'b', card: card('missed') };
const hit = (id: number, playerId: string, amount = 1): LogEntryView => ({
  id,
  type: 'HIT',
  playerId,
  amount,
  sourceId: null,
});
const death = (id: number, playerId: string): LogEntryView => ({
  id,
  type: 'DEATH',
  playerId,
  role: 'outlaw',
  killerId: null,
  lootedById: null,
});
const flip = (
  id: number,
  reason: 'barrel' | 'jail' | 'dynamite',
  passed: boolean,
): LogEntryView => ({
  id,
  type: 'CHECK',
  playerId: 'b',
  reason,
  cards: [card('beer')],
  passed,
});

describe('what the table has not shown yet', () => {
  it('starts from nothing on an empty log', () => {
    expect(lastLogId([])).toBe(0);
    expect(entriesAfter([], 0)).toEqual([]);
  });

  it('keeps only the entries after the last one seen', () => {
    const log = [play, missed, hit(3, 'b')];
    expect(lastLogId(log)).toBe(3);
    expect(entriesAfter(log, 1).map((entry) => entry.id)).toEqual([2, 3]);
    expect(entriesAfter(log, 3)).toEqual([]);
  });
});

describe('what a seat shows', () => {
  it('shows nothing for a card played, a draw or a turn', () => {
    const turn: LogEntryView = { id: 4, type: 'TURN', playerId: 'a' };
    const draw: LogEntryView = {
      id: 5,
      type: 'DRAW',
      playerId: 'a',
      count: 2,
      from: 'deck',
      shown: null,
    };
    expect(seatEffects([play, turn, draw])).toEqual({});
  });

  it('shows an answer on whoever answered', () => {
    expect(seatEffects([play, missed])).toEqual({ b: { id: 2, kind: 'answer', amount: 0 } });
  });

  it('shows a barrel that held as an answer, and one that did not as nothing', () => {
    expect(seatEffects([flip(3, 'barrel', true)]).b?.kind).toBe('answer');
    expect(seatEffects([flip(3, 'barrel', false)])).toEqual({});
    expect(seatEffects([flip(3, 'jail', false)])).toEqual({});
  });

  it('shows a hit with the life it cost', () => {
    expect(seatEffects([hit(3, 'b', 2)])).toEqual({ b: { id: 3, kind: 'hit', amount: 2 } });
  });

  it('tells a dynamite going off from a shot', () => {
    expect(seatEffects([flip(3, 'dynamite', false), hit(4, 'b', 3)])).toEqual({
      b: { id: 4, kind: 'blast', amount: 3 },
    });
    // A dynamite that passes on quietly leaves a later shot a shot.
    expect(seatEffects([flip(3, 'dynamite', true), hit(4, 'b')]).b?.kind).toBe('hit');
    // Someone else's hit is not the blast.
    expect(seatEffects([flip(3, 'dynamite', false), hit(4, 'c')]).c?.kind).toBe('hit');
  });

  it('shows the gravest thing when several happen to one player', () => {
    const effects = seatEffects([missed, hit(3, 'b'), death(4, 'b'), hit(5, 'c')]);
    expect(effects.b).toEqual({ id: 4, kind: 'death', amount: 0 });
    expect(effects.c?.kind).toBe('hit');
  });

  it('shows the latest of two alike, so a second shot shakes the seat again', () => {
    expect(seatEffects([hit(3, 'b'), hit(6, 'b')]).b?.id).toBe(6);
  });
});
