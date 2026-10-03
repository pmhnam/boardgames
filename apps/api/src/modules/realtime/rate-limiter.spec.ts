import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limiter.js';

describe('RateLimiter', () => {
  it('allows a burst up to capacity, then refuses', () => {
    const limiter = new RateLimiter(3, 1, 0);
    expect([0, 0, 0, 0].map((now) => limiter.tryConsume(now))).toEqual([true, true, true, false]);
  });

  it('refills over time', () => {
    const limiter = new RateLimiter(1, 2, 0);
    expect(limiter.tryConsume(0)).toBe(true);
    expect(limiter.tryConsume(100)).toBe(false);
    expect(limiter.tryConsume(600)).toBe(true);
  });
});
