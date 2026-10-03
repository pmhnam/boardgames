import { describe, expect, it } from 'vitest';
import { calculatePlayerScore, calculateScores } from '../src/scoring/score.js';
import { P1, P2, emptyBoard, stateFromBoard } from './fixtures/states.js';

describe('scoring', () => {
  it('scores zero on an empty board', () => {
    expect(calculateScores(stateFromBoard(emptyBoard))).toEqual({ [P1]: 0, [P2]: 0 });
  });

  it('scores one point per isolated piece', () => {
    const state = stateFromBoard(['1.1..', '.....', '1....', '.....', '....2']);
    expect(calculatePlayerScore(state, P1)).toBe(3);
    expect(calculatePlayerScore(state, P2)).toBe(1);
  });

  it('adds one point per orthogonally adjacent pair', () => {
    // Line of three: 3 pieces + 2 pairs.
    expect(
      calculatePlayerScore(stateFromBoard(['111..', '.....', '.....', '.....', '.....']), P1),
    ).toBe(5);
    // 2x2 square: 4 pieces + 4 pairs.
    expect(
      calculatePlayerScore(stateFromBoard(['11...', '11...', '.....', '.....', '.....']), P1),
    ).toBe(8);
  });

  it('ignores diagonals, blocked cells and opponent pieces', () => {
    const state = stateFromBoard(['1#1..', '21...', '.....', '.....', '.....']);
    // P1: 3 pieces, no orthogonal pairs.
    expect(calculatePlayerScore(state, P1)).toBe(3);
  });
});
