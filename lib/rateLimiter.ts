/**
 * Token bucket rate limiter with a score-ordered priority queue.
 *
 * Capacity is 55 req/min (not 60) to leave a 5 req/min buffer against clock
 * skew between our refill timer and Finnhub's server-side rate limit window.
 *
 * Priority is a continuous float (0.0 – 1.0). The queue drains highest score
 * first, so callers pass their actual computed score rather than a coarse tier:
 *
 *   1.0  — user-initiated requests (cache misses on quote, search, asset detail)
 *   0.0  — background jobs (screener universe refresh, profile/metrics on miss)
 *   0–1  — tickerScheduler passes the ticker's live score directly, so a ticker
 *           with score 0.85 preempts one with 0.40 within the same drain cycle
 *
 * Convenience constants exported for non-scored callers:
 *   PRIORITY.USER       = 1.0
 *   PRIORITY.BACKGROUND = 0.0
 */

export const PRIORITY = {
  USER: 1.0,
  BACKGROUND: 0.0,
} as const;

interface QueuedRequest<T = unknown> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  score: number;
}

class ApiRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly tokensPerMs: number;
  private lastRefill: number;
  private queue: QueuedRequest[] = [];
  private drainTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequestsPerMinute = 55) {
    this.maxTokens = maxRequestsPerMinute;
    this.tokens = maxRequestsPerMinute;
    this.tokensPerMs = maxRequestsPerMinute / 60_000;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + (now - this.lastRefill) * this.tokensPerMs
    );
    this.lastRefill = now;
  }

  private drain(): void {
    this.refill();
    // Sort descending by score — highest priority drains first
    this.queue.sort((a, b) => b.score - a.score);
    while (this.tokens >= 1 && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.tokens -= 1;
      item.fn().then(item.resolve).catch(item.reject);
    }
    if (this.queue.length === 0 && this.drainTimer !== null) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
  }

  private scheduleDrain(): void {
    if (this.drainTimer !== null) return;
    this.drainTimer = setInterval(() => this.drain(), 1_000);
  }

  enqueue<T>(fn: () => Promise<T>, score: number = 0.5): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      (this.queue as QueuedRequest<T>[]).push({ fn, resolve, reject, score });
      this.scheduleDrain();
      this.drain(); // immediate attempt if tokens are available
    });
  }

  stats(): { tokens: number; queued: number } {
    this.refill();
    return {
      tokens: Math.floor(this.tokens),
      queued: this.queue.length,
    };
  }
}

export const rateLimiter = new ApiRateLimiter(55);
