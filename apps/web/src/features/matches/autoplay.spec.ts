import type { GameStateMessage, PlayerAutoplayDto } from '@bgp/shared-types';
import { describe, expect, it } from 'vitest';
import { acceptMatchMessage, mergeAutoplay } from './autoplay';

const control = (
  version: number,
  level: PlayerAutoplayDto['level'],
  playerId = 'p1',
): PlayerAutoplayDto => ({ playerId, version, level });
const snapshot = (version: number, gameId = 'match'): GameStateMessage => ({
  gameId,
  gameType: 'harmonies',
  version,
  status: 'playing',
  viewerPlayerId: 'p1',
  state: { version },
});

describe('autoplay synchronisation', () => {
  it('keeps a newer disable when an old enable HTTP reply or snapshot arrives', () => {
    const disabled = [control(2, null)];
    expect(mergeAutoplay(disabled, [control(1, 'normal')])).toEqual(disabled);
  });

  it('merges each player independently, including updates to a waiting seat', () => {
    expect(
      mergeAutoplay([control(2, null)], [control(1, 'normal'), control(3, 'normal', 'p2')]),
    ).toEqual([control(2, null), control(3, 'normal', 'p2')]);
  });

  it('accepts new control metadata without regressing the game action sequence', () => {
    const result = acceptMatchMessage(snapshot(10), snapshot(8), [control(2, null)]);
    expect(result.version).toBe(10);
    expect(result.state).toEqual({ version: 10 });
    expect(result.autoplay).toEqual([control(2, null)]);
  });

  it('does not keep the previous match state when switching matches', () => {
    expect(
      acceptMatchMessage(snapshot(10), snapshot(0, 'new-match'), [control(0, null)]),
    ).toMatchObject({
      gameId: 'new-match',
      version: 0,
      autoplay: [control(0, null)],
    });
  });
});
