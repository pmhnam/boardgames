import type { MatchDto, MatchPlayerDto } from '@bgp/shared-types';
import { describe, expect, it } from 'vitest';
import { matchStanding, otherPlayerNames } from './history';

const player = (userId: string, seat: number): MatchPlayerDto => ({
  playerId: `player-${userId}`,
  userId,
  displayName: userId.toUpperCase(),
  seat,
  botLevel: null,
  autoplayLevel: null,
  controlVersion: 0,
});

const match = (status: MatchDto['status'], winners?: string[]) => ({
  status,
  players: [player('ann', 0), player('bo', 1), player('cy', 2)],
  result: winners ? { winnerPlayerIds: winners.map((userId) => `player-${userId}`) } : null,
});

describe('matchStanding', () => {
  it('says a match still going is being played', () => {
    expect(matchStanding(match('playing'), 'ann')).toBe('playing');
  });

  it('says an abandoned match was abandoned, whatever result it carries', () => {
    expect(matchStanding(match('abandoned', ['ann']), 'ann')).toBe('abandoned');
  });

  it('tells the winner they won and the others they lost', () => {
    expect(matchStanding(match('finished', ['bo']), 'bo')).toBe('won');
    expect(matchStanding(match('finished', ['bo']), 'ann')).toBe('lost');
  });

  it('counts everyone on a winning team as a winner', () => {
    expect(matchStanding(match('finished', ['ann', 'cy']), 'cy')).toBe('won');
  });

  it('takes no side when nobody won', () => {
    expect(matchStanding(match('finished', []), 'ann')).toBe('finished');
    expect(matchStanding(match('finished'), 'ann')).toBe('finished');
  });

  it('takes no side for someone who was not seated', () => {
    expect(matchStanding(match('finished', ['bo']), 'dee')).toBe('finished');
    expect(matchStanding(match('finished', ['bo']), undefined)).toBe('finished');
  });
});

describe('otherPlayerNames', () => {
  it('lists everyone but the viewer, by seat', () => {
    const players = [player('cy', 2), player('ann', 0), player('bo', 1)];
    expect(otherPlayerNames({ players }, 'bo')).toEqual(['ANN', 'CY']);
  });

  it('is empty for a table of one', () => {
    expect(otherPlayerNames({ players: [player('ann', 0)] }, 'ann')).toEqual([]);
  });
});
