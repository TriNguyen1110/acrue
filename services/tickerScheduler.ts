import { prisma } from "@/lib/db";
import { rateLimiter } from "@/lib/rateLimiter";
import type { Quote } from "@/types";

/**
 * Weights for the ticker refresh priority score.
 *
 * importance  (0.35) — tickers watched by more users have higher blast radius if stale
 * staleness   (0.25) — data age is always a baseline urgency signal
 * volatility  (0.25) — an actively moving ticker needs fresh data more than a flat one
 * volumeSpike (0.15) — unusual volume often precedes or accompanies a price event
 */
const WEIGHTS = {
  importance:  0.35,
  staleness:   0.25,
  volatility:  0.25,
  volumeSpike: 0.15,
};

/**
 * How often the priority queue is rebuilt from the DB.
 * Each rebuild: refreshes watcher counts, adds new tickers, drops removed ones,
 * and re-scores everything so the drain loop always works from fresh priorities.
 */
const QUEUE_REBUILD_INTERVAL_MS = 60_000;

/**
 * Drain interval derived from the rate-limiter budget.
 * Fires 55× per minute — if the queue has fewer than 55 items, the drain
 * simply skips empty slots, so we never exceed the API budget.
 */
const DRAIN_INTERVAL_MS = Math.ceil(60_000 / 55); // ≈ 1091 ms

interface TickerMeta {
  watcherCount: number;
  lastFetchedAt: number; // ms since epoch — updated after every successful fetch
  changePct:    number;  // from last fetched quote
  volume:       number;
  avgVolume:    number;
}

/**
 * Priority-queue-driven ticker refresh scheduler.
 *
 * Two timers run concurrently:
 *
 *   rebuildTimer (60s) — queries the DB, refreshes watcher counts, scores every
 *     ticker, and replaces the in-memory queue with a freshly sorted array.
 *     New tickers added to any watchlist appear at the next rebuild (or immediately
 *     via register()). Removed tickers are pruned.
 *
 *   drainTimer (~1091ms) — pops the highest-scored item from the queue and fires
 *     one Finnhub quote fetch through the rate limiter. Skips when the queue is
 *     empty. Because the rate limiter also caps at 55 req/min, the two controls
 *     are complementary: the drain timer paces enqueues, the rate limiter
 *     prevents bursts if the drain timer ever gets ahead.
 *
 * After each successful fetch, onQuoteFetched() updates in-memory metadata so
 * the NEXT rebuild scores the ticker accurately (staleness, volatility, volume).
 */
class TickerScheduler {
  private tickers:              Map<string, TickerMeta> = new Map();
  private queue:                Array<{ ticker: string; score: number }> = [];
  private drainTimer:           ReturnType<typeof setInterval> | null = null;
  private rebuildTimer:         ReturnType<typeof setInterval> | null = null;
  private afterFetchListeners:  Array<(ticker: string, quote: Quote) => void> = [];

  /** Register a callback that fires after every successful quote fetch. */
  addAfterFetchListener(cb: (ticker: string, quote: Quote) => void): void {
    this.afterFetchListeners.push(cb);
  }

  start(): void {
    // Build the queue immediately, then on every subsequent minute
    this.rebuildQueue();
    this.rebuildTimer = setInterval(() => this.rebuildQueue(), QUEUE_REBUILD_INTERVAL_MS);

    // Drain one item per slot — up to 55×/min
    this.drainTimer = setInterval(() => this.drain(), DRAIN_INTERVAL_MS);
  }

  stop(): void {
    if (this.drainTimer)   clearInterval(this.drainTimer);
    if (this.rebuildTimer) clearInterval(this.rebuildTimer);
    this.drainTimer   = null;
    this.rebuildTimer = null;
  }

  /**
   * Called externally after a successful quote fetch to keep metadata current
   * so the next rebuild scores staleness/volatility/volume accurately.
   */
  onQuoteFetched(ticker: string, quote: Quote): void {
    const meta = this.tickers.get(ticker.toUpperCase());
    if (!meta) return;
    meta.lastFetchedAt = Date.now();
    meta.changePct     = quote.changePct;
    meta.volume        = quote.volume;
    meta.avgVolume     = quote.avgVolume;
    for (const cb of this.afterFetchListeners) cb(ticker, quote);
  }

  /**
   * Immediately adds a ticker when a user adds it to their watchlist.
   * Inserted at the front of the current queue (max-stale score = 1.0)
   * so it gets fetched on the very next drain slot.
   */
  register(ticker: string): void {
    const upper = ticker.toUpperCase();
    if (this.tickers.has(upper)) return;
    this.tickers.set(upper, {
      watcherCount:  1,
      lastFetchedAt: 0,
      changePct:     0,
      volume:        0,
      avgVolume:     0,
    });
    this.queue.unshift({ ticker: upper, score: 1.0 });
  }

  /** Removes a ticker when it's no longer watched by anyone. */
  deregister(ticker: string): void {
    const upper = ticker.toUpperCase();
    this.tickers.delete(upper);
    this.queue = this.queue.filter((item) => item.ticker !== upper);
  }

  // ── Private ──────────────────────────────────────────────────────────────────

  /**
   * Rebuilds the priority queue from scratch:
   *   1. Refresh watcher counts from DB (adds new tickers, prunes removed ones)
   *   2. Score every ticker using current metadata + Date.now() for staleness
   *   3. Sort descending — highest-priority tickers drain first
   */
  private async rebuildQueue(): Promise<void> {
    const rows = await prisma.$queryRaw<Array<{ ticker: string; count: bigint }>>`
      SELECT ticker, COUNT(*)::int AS count FROM "Watchlist" GROUP BY ticker
    `.catch(() => [] as Array<{ ticker: string; count: bigint }>);

    // Sync the in-memory ticker map with the DB snapshot
    const seen = new Set<string>();
    for (const row of rows) {
      const upper = row.ticker.toUpperCase();
      seen.add(upper);
      const existing = this.tickers.get(upper);
      if (existing) {
        existing.watcherCount = Number(row.count);
      } else {
        this.tickers.set(upper, {
          watcherCount:  Number(row.count),
          lastFetchedAt: 0,
          changePct:     0,
          volume:        0,
          avgVolume:     0,
        });
      }
    }
    for (const ticker of this.tickers.keys()) {
      if (!seen.has(ticker)) this.tickers.delete(ticker);
    }

    if (this.tickers.size === 0) {
      this.queue = [];
      return;
    }

    const maxWatchers = Math.max(...[...this.tickers.values()].map((m) => m.watcherCount), 1);

    this.queue = [...this.tickers.entries()]
      .map(([ticker, meta]) => ({ ticker, score: this.computeScore(meta, maxWatchers) }))
      .sort((a, b) => b.score - a.score);
  }

  private computeScore(meta: TickerMeta, maxWatchers: number): number {
    const importance = meta.watcherCount / maxWatchers;

    const ageMs    = Date.now() - meta.lastFetchedAt;
    const staleness = Math.min(ageMs, 60_000) / 60_000;

    const volatility = Math.min(Math.abs(meta.changePct) / 10, 1);

    const volumeSpike =
      meta.avgVolume > 0 && meta.volume > 0
        ? Math.min(meta.volume / meta.avgVolume / 3, 1)
        : 0;

    return (
      WEIGHTS.importance  * importance  +
      WEIGHTS.staleness   * staleness   +
      WEIGHTS.volatility  * volatility  +
      WEIGHTS.volumeSpike * volumeSpike
    );
  }

  /**
   * Pops the highest-scored item from the queue and fires a rate-limited fetch.
   * Called ~55× per minute. No-ops when the queue is empty.
   */
  private drain(): void {
    const item = this.queue.shift();
    if (!item) return;

    rateLimiter
      .enqueue(
        async () => {
          const { getQuote } = await import("@/lib/finnhub");
          const quote = await getQuote(item.ticker, item.score);
          this.onQuoteFetched(item.ticker, quote);
          return quote;
        },
        item.score
      )
      .catch(() => {
        // On failure reset staleness so the ticker is prioritised on the next rebuild
        const meta = this.tickers.get(item.ticker);
        if (meta) meta.lastFetchedAt = 0;
      });
  }
}

export const tickerScheduler = new TickerScheduler();
