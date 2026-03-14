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
  importance: 0.35,
  staleness: 0.25,
  volatility: 0.25,
  volumeSpike: 0.15,
};

/**
 * Minimum age before a ticker is eligible to be re-fetched.
 *
 * Prevents the scheduler from re-queuing a ticker that was just fetched, which
 * would waste tokens and could loop the same popular ticker every second while
 * less-popular tickers never get refreshed.
 */
const MIN_REFRESH_INTERVAL_MS = 45_000;

interface TickerMeta {
  watcherCount: number;
  lastFetchedAt: number; // tracked in-memory — no Redis read needed for staleness
  changePct: number;     // from last fetched quote
  volume: number;
  avgVolume: number;
}

/**
 * Continuous ticker refresh scheduler.
 *
 * Instead of pre-sorting all tickers at cron time and batch-enqueueing them
 * (which locks in stale scores), this scheduler runs a 1s tick that re-scores
 * every ticker with the current time and enqueues only the single highest-scored
 * eligible ticker per tick.
 *
 * This means:
 *   - Staleness is always computed against Date.now() — scores never go stale
 *   - The MEDIUM queue depth is always 0 or 1 items
 *   - A ticker that surges in volatility mid-cycle jumps to the front immediately
 *   - HIGH priority requests still preempt freely (rate limiter drains HIGH first)
 *
 * lastFetchedAt is maintained in-memory here (same process) rather than read
 * from Redis on every tick, keeping the scoring loop I/O-free.
 */
class TickerScheduler {
  private tickers: Map<string, TickerMeta> = new Map();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private watcherTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    this.refreshWatcherCounts();
    this.watcherTimer = setInterval(() => this.refreshWatcherCounts(), 60_000);
    this.tickTimer = setInterval(() => this.tick(), 1_000);
  }

  stop(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    if (this.watcherTimer) clearInterval(this.watcherTimer);
    this.tickTimer = null;
    this.watcherTimer = null;
  }

  /**
   * Called by getQuote after a successful fetch to keep in-memory state current.
   * This is what makes staleness scoring accurate without Redis reads.
   */
  onQuoteFetched(ticker: string, quote: Quote): void {
    const meta = this.tickers.get(ticker.toUpperCase());
    if (!meta) return;
    meta.lastFetchedAt = Date.now();
    meta.changePct = quote.changePct;
    meta.volume = quote.volume;
    meta.avgVolume = quote.avgVolume;
  }

  /**
   * Adds a ticker to the scheduler when a user adds it to their watchlist.
   * Scores as maximally stale (lastFetchedAt = 0) so it's fetched on the next tick.
   */
  register(ticker: string): void {
    const upper = ticker.toUpperCase();
    if (this.tickers.has(upper)) return;
    this.tickers.set(upper, {
      watcherCount: 1,
      lastFetchedAt: 0,
      changePct: 0,
      volume: 0,
      avgVolume: 0,
    });
    this.refreshWatcherCounts(); // recount so the new ticker gets the right weight
  }

  /**
   * Removes a ticker when it's no longer watched by anyone.
   */
  deregister(ticker: string): void {
    this.tickers.delete(ticker.toUpperCase());
  }

  private async refreshWatcherCounts(): Promise<void> {
    const rows = await prisma.$queryRaw<Array<{ ticker: string; count: bigint }>>`
      SELECT ticker, COUNT(*)::int AS count FROM watchlist GROUP BY ticker
    `.catch(() => [] as Array<{ ticker: string; count: bigint }>);

    // Add new tickers and update counts; preserve lastFetchedAt and quote metrics
    const seen = new Set<string>();
    for (const row of rows) {
      const upper = row.ticker.toUpperCase();
      seen.add(upper);
      const existing = this.tickers.get(upper);
      if (existing) {
        existing.watcherCount = Number(row.count);
      } else {
        this.tickers.set(upper, {
          watcherCount: Number(row.count),
          lastFetchedAt: 0,
          changePct: 0,
          volume: 0,
          avgVolume: 0,
        });
      }
    }
    // Remove tickers no longer on any watchlist
    for (const ticker of this.tickers.keys()) {
      if (!seen.has(ticker)) this.tickers.delete(ticker);
    }
  }

  private computeScore(meta: TickerMeta, maxWatchers: number): number {
    const importance = meta.watcherCount / maxWatchers;

    // Staleness uses Date.now() — always accurate, no I/O needed
    const ageMs = Date.now() - meta.lastFetchedAt;
    const staleness = Math.min(ageMs, 60_000) / 60_000;

    // caps at 10% move = full volatility score
    const volatility = Math.min(Math.abs(meta.changePct) / 10, 1);

    // caps at 3× average volume = full spike score
    // gracefully scores 0 on cold start when volume is unknown
    const volumeSpike =
      meta.avgVolume > 0 && meta.volume > 0
        ? Math.min(meta.volume / meta.avgVolume / 3, 1)
        : 0;

    return (
      WEIGHTS.importance * importance +
      WEIGHTS.staleness * staleness +
      WEIGHTS.volatility * volatility +
      WEIGHTS.volumeSpike * volumeSpike
    );
  }

  private pickNext(): string | null {
    if (this.tickers.size === 0) return null;

    const now = Date.now();
    const maxWatchers = Math.max(
      ...[...this.tickers.values()].map((m) => m.watcherCount),
      1
    );

    let bestTicker: string | null = null;
    let bestScore = -1;

    for (const [ticker, meta] of this.tickers) {
      // Skip tickers fetched too recently — avoids burning tokens on the same
      // popular ticker every second while low-watcher tickers starve
      if (now - meta.lastFetchedAt < MIN_REFRESH_INTERVAL_MS) continue;

      const score = this.computeScore(meta, maxWatchers);
      if (score > bestScore) {
        bestScore = score;
        bestTicker = ticker;
      }
    }

    return bestTicker;
  }

  private tick(): void {
    const ticker = this.pickNext();
    if (!ticker) return;

    // Optimistically mark as fetching now so the next tick doesn't double-queue it
    const meta = this.tickers.get(ticker);
    if (meta) meta.lastFetchedAt = Date.now();

    rateLimiter
      .enqueue(
        async () => {
          const { getQuote } = await import("@/lib/finnhub");
          const quote = await getQuote(ticker, "medium");
          this.onQuoteFetched(ticker, quote);
          return quote;
        },
        "medium"
      )
      .catch(() => {
        // Reset lastFetchedAt on failure so the ticker is retried next cycle
        const m = this.tickers.get(ticker);
        if (m) m.lastFetchedAt = 0;
      });
  }
}

export const tickerScheduler = new TickerScheduler();
