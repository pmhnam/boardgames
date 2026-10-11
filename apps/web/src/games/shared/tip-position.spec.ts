import { describe, expect, it } from 'vitest';
import { placeTip } from './tip-position';

describe('placeTip', () => {
  const viewport = { width: 400, height: 600 };
  const bubble = { width: 100, height: 40 };

  it('centres the hint above what it explains', () => {
    const anchor = { left: 180, top: 300, width: 40, height: 20 };
    expect(placeTip(anchor, bubble, viewport)).toEqual({ left: 150, top: 252 });
  });

  it('goes below when there is no room above', () => {
    const anchor = { left: 180, top: 30, width: 40, height: 20 };
    expect(placeTip(anchor, bubble, viewport)).toEqual({ left: 150, top: 58 });
  });

  it('stays inside the left and right edges of the window', () => {
    const atLeft = { left: 0, top: 300, width: 20, height: 20 };
    const atRight = { left: 380, top: 300, width: 20, height: 20 };
    expect(placeTip(atLeft, bubble, viewport).left).toBe(8);
    expect(placeTip(atRight, bubble, viewport).left).toBe(292);
  });

  it('starts a hint wider than the window at its left edge', () => {
    const anchor = { left: 180, top: 300, width: 40, height: 20 };
    expect(placeTip(anchor, { width: 500, height: 40 }, viewport).left).toBe(8);
  });
});
