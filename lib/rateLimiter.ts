type Priority = "high" | "medium" | "low";

interface QueuedRequest<T = unknown> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

const PRIORITY_ORDER: Priority[] = ["high", "medium", "low"];

/**
 * Token bucket rate limiter with a 3-tier priority queue.
 *
 * Capacity is 55 req/min (not 60) to leave a 5 req/min buffer against clock skew
 * between our refill timer and Finnhub's server-side rate limit window. A burst
 * at the boundary of both windows could briefly exceed 60 from Finnhub's perspective
 * without this buffer, resulting in 429 errors.
 *
 * Priority tiers:
 *   HIGH   — user-initiated requests (cache misses on quote lookup, search, asset detail)
 *   MEDIUM — per-minute watchlist quote refresh driven by tickerScheduler
 *   LOW    — background jobs: signal scoring candles, alert candles, screener universe,
 *            profile/metrics fetches on cache miss
 *
 * Within each tier requests are processed FIFO. tickerScheduler pre-sorts MEDIUM
 * enqueues by score so FIFO within MEDIUM still yields priority order.
 */
class ApiRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly tokensPerMs: number;
  private lastRefill: number;
  private readonly queues: Record<Priority, QueuedRequest[]>;
  private drainTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequestsPerMinute = 55) {
    this.maxTokens = maxRequestsPerMinute;
    this.tokens = maxRequestsPerMinute;
    this.tokensPerMs = maxRequestsPerMinute / 60_000;
    this.lastRefill = Date.now();
    this.queues = { high: [], medium: [], low: [] };
  }

  private refill(): void {
    const now = Date.now();
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + (now - this.lastRefill) * this.tokensPerMs
    );
    this.lastRefill = now;
  }

  private nextItem(): QueuedRequest | null {
    for (const p of PRIORITY_ORDER) {
      if (this.queues[p].length > 0) return this.queues[p].shift()!;
    }
    return null;
  }

  private totalQueued(): number {
    return PRIORITY_ORDER.reduce((n, p) => n + this.queues[p].length, 0);
  }

  private drain(): void {
    this.refill();
    while (this.tokens >= 1) {
      const item = this.nextItem();
      if (!item) break;
      this.tokens -= 1;
      item.fn().then(item.resolve).catch(item.reject);
    }
    if (this.totalQueued() === 0 && this.drainTimer !== null) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
  }

  private scheduleDrain(): void {
    if (this.drainTimer !== null) return;
    this.drainTimer = setInterval(() => this.drain(), 1_000);
  }

  enqueue<T>(fn: () => Promise<T>, priority: Priority = "medium"): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      (this.queues[priority] as QueuedRequest<T>[]).push({ fn, resolve, reject });
      this.scheduleDrain();
      this.drain(); // immediate attempt if tokens are available
    });
  }

  stats(): { tokens: number; queued: Record<Priority, number> } {
    this.refill();
    return {
      tokens: Math.floor(this.tokens),
      queued: {
        high: this.queues.high.length,
        medium: this.queues.medium.length,
        low: this.queues.low.length,
      },
    };
  }
}

export const rateLimiter = new ApiRateLimiter(55);
