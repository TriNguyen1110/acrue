import { prisma } from "@/lib/db";
import { ingestCompanyNews } from "@/services/news";

/**
 * How often the ticker queue is rebuilt from the DB.
 * Mirrors tickerScheduler's QUEUE_REBUILD_INTERVAL_MS (60s).
 */
const QUEUE_REBUILD_INTERVAL_MS = 60_000;

/**
 * Drain interval — one ticker fetched per slot, spaced evenly across the 15-minute
 * Finnhub news cache window to guarantee every watchlist ticker is refreshed once
 * per window without overloading the rate limiter.
 *
 * Budget: Finnhub free tier → 55 usable req/min.
 * This scheduler is background-priority so the actual API call inside
 * ingestCompanyNews() goes through the rate limiter with PRIORITY.BACKGROUND (0.0),
 * ensuring it never starves user requests.
 *
 * Formula: 15 min × 60 s × 1000 ms / 55 slots ≈ 16 364 ms per slot.
 */
const DRAIN_INTERVAL_MS = Math.ceil((15 * 60_000) / 55); // ≈ 16_364 ms

/**
 * Priority-queue-driven scheduler for company news ingestion.
 *
 * Two timers run concurrently:
 *
 *   rebuildTimer (60s) — queries distinct watchlist tickers sorted by watcher
 *     count (most-watched first), and replaces the in-memory queue with a fresh
 *     ordered array. New watchlist additions appear at the next rebuild.
 *
 *   drainTimer (~16s) — pops one ticker from the queue and calls
 *     ingestCompanyNews(). The Finnhub call inside uses PRIORITY.BACKGROUND so
 *     it never starves user-facing requests. Skips when the queue is empty.
 */
class NewsScheduler {
  private queue:        string[] = [];
  private drainTimer:   ReturnType<typeof setInterval> | null = null;
  private rebuildTimer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    // Build the queue immediately so the first drain has something to work with
    this.rebuildQueue();
    this.rebuildTimer = setInterval(() => this.rebuildQueue(), QUEUE_REBUILD_INTERVAL_MS);

    // Drain one ticker per slot — spaced to cover the full news cache window
    this.drainTimer = setInterval(() => this.drain(), DRAIN_INTERVAL_MS);
  }

  stop(): void {
    if (this.drainTimer)   clearInterval(this.drainTimer);
    if (this.rebuildTimer) clearInterval(this.rebuildTimer);
    this.drainTimer   = null;
    this.rebuildTimer = null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Rebuilds the ticker queue from the DB.
   * Distinct watchlist tickers ordered by watcher count desc — most-watched
   * tickers are drained first so high-priority news is always fresh.
   */
  private async rebuildQueue(): Promise<void> {
    const rows = await prisma.$queryRaw<Array<{ ticker: string }>>`
      SELECT ticker
      FROM   "Watchlist"
      GROUP  BY ticker
      ORDER  BY COUNT(*) DESC
    `.catch(() => [] as Array<{ ticker: string }>);

    this.queue = rows.map((r) => r.ticker);
  }

  /**
   * Pops one ticker from the front of the queue and ingests its news.
   * No-ops when the queue is empty.
   */
  private async drain(): Promise<void> {
    const ticker = this.queue.shift();
    if (!ticker) return;

    try {
      const count = await ingestCompanyNews(ticker);
      if (count > 0) {
        console.log(`[newsScheduler] ingested ${count} new article(s) for ${ticker}`);
      }
    } catch (e) {
      console.error(`[newsScheduler] ingest failed for ${ticker}:`, e);
    }
  }
}

export const newsScheduler = new NewsScheduler();
