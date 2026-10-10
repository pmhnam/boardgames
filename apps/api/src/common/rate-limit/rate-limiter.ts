/** Token bucket: `capacity` burst, refilled at `refillPerSecond`. */
export class RateLimiter {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    nowMs: number = Date.now(),
  ) {
    this.tokens = capacity;
    this.lastRefillMs = nowMs;
  }

  tryConsume(nowMs: number = Date.now()): boolean {
    const elapsedSeconds = (nowMs - this.lastRefillMs) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefillMs = nowMs;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  /** Hands back a token taken by an attempt that turned out not to count. */
  refund(): void {
    this.tokens = Math.min(this.capacity, this.tokens + 1);
  }
}
