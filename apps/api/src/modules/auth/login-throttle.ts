import { RateLimiter } from '../../common/rate-limit/rate-limiter.js';

const PER_ADDRESS_BURST = 5;
const PER_ADDRESS_REFILL_PER_SECOND = 1 / 30;
/** Caps the password hashing the whole server will do, whatever addresses the guesses use. */
const GLOBAL_BURST = 30;
const GLOBAL_REFILL_PER_SECOND = 1 / 2;
const PRUNE_ABOVE = 1000;
/** A bucket left alone this long is full again, so forgetting it changes nothing. */
const FULL_AGAIN_MS = (PER_ADDRESS_BURST / PER_ADDRESS_REFILL_PER_SECOND) * 1000;

interface Bucket {
  limiter: RateLimiter;
  lastSeenMs: number;
}

/**
 * Slows password guessing. Buckets are per address rather than per username, so nobody can
 * lock an administrator out by guessing at their name.
 */
export class LoginThrottle {
  private readonly perAddress = new Map<string, Bucket>();
  private readonly global: RateLimiter;

  constructor(nowMs: number = Date.now()) {
    this.global = new RateLimiter(GLOBAL_BURST, GLOBAL_REFILL_PER_SECOND, nowMs);
  }

  /** Call before checking a password; false means the attempt must be refused unchecked. */
  tryConsume(address: string, nowMs: number = Date.now()): boolean {
    let bucket = this.perAddress.get(address);
    if (!bucket) {
      if (this.perAddress.size >= PRUNE_ABOVE) this.prune(nowMs);
      bucket = {
        limiter: new RateLimiter(PER_ADDRESS_BURST, PER_ADDRESS_REFILL_PER_SECOND, nowMs),
        lastSeenMs: nowMs,
      };
      this.perAddress.set(address, bucket);
    }
    bucket.lastSeenMs = nowMs;
    if (!bucket.limiter.tryConsume(nowMs)) return false;
    if (this.global.tryConsume(nowMs)) return true;
    bucket.limiter.refund();
    return false;
  }

  /** A correct password does not count against the address that gave it. */
  succeeded(address: string): void {
    this.perAddress.get(address)?.limiter.refund();
  }

  private prune(nowMs: number): void {
    for (const [address, bucket] of this.perAddress) {
      if (nowMs - bucket.lastSeenMs >= FULL_AGAIN_MS) this.perAddress.delete(address);
    }
  }
}
