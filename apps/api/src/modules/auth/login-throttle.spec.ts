import { describe, expect, it } from 'vitest';
import { LoginThrottle } from './login-throttle.js';

function attempts(throttle: LoginThrottle, address: string, count: number, nowMs: number) {
  return Array.from({ length: count }, () => throttle.tryConsume(address, nowMs));
}

describe('LoginThrottle', () => {
  it('lets one address guess five times, then makes it wait 30 seconds per guess', () => {
    const throttle = new LoginThrottle(0);
    expect(attempts(throttle, 'a', 6, 0)).toEqual([true, true, true, true, true, false]);
    expect(throttle.tryConsume('a', 29_000)).toBe(false);
    expect(throttle.tryConsume('a', 30_000)).toBe(true);
    expect(throttle.tryConsume('a', 30_000)).toBe(false);
  });

  it('keeps addresses apart, so one guesser cannot lock another address out', () => {
    const throttle = new LoginThrottle(0);
    attempts(throttle, 'a', 6, 0);
    expect(throttle.tryConsume('b', 0)).toBe(true);
  });

  it('does not count correct passwords against the address', () => {
    const throttle = new LoginThrottle(0);
    for (let i = 0; i < 12; i++) {
      expect(throttle.tryConsume('a', 0)).toBe(true);
      throttle.succeeded('a');
    }
  });

  it('caps guesses across all addresses, without charging the address it turned away', () => {
    const throttle = new LoginThrottle(0);
    const spread = Array.from({ length: 31 }, (_, i) => throttle.tryConsume(`address-${i}`, 0));
    expect(spread.filter(Boolean)).toHaveLength(30);
    expect(spread[30]).toBe(false);
    // Two seconds later the server takes one more. The refused address was not charged for the
    // guess that was turned away: of its five, only that one accepted guess is gone.
    expect(attempts(throttle, 'address-30', 2, 2_000)).toEqual([true, false]);
    expect(attempts(throttle, 'address-30', 5, 12_000)).toEqual([true, true, true, true, false]);
  });

  it('forgets idle addresses once it holds too many, which costs them nothing', () => {
    const throttle = new LoginThrottle(0);
    for (let i = 0; i < 1000; i++) throttle.tryConsume(`old-${i}`, i * 3_000);
    const later = 1000 * 3_000 + 150_000;
    expect(attempts(throttle, 'old-0', 5, later)).toEqual([true, true, true, true, true]);
  });
});
