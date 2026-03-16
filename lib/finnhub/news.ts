import { redis } from "@/lib/cache";
import { finnhubGet, PRIORITY } from "./client";

const NEWS_TTL = 15 * 60; // 15 min — company news updates infrequently within a session

// ── Finnhub response shape ────────────────────────────────────────────────────

export interface FinnhubNewsItem {
  headline: string;
  summary:  string;
  source:   string;
  url:      string;
  datetime: number; // unix timestamp (seconds)
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetches recent company news for a single ticker from Finnhub.
 *
 * Covers the last 7 days. Uses PRIORITY.BACKGROUND (0.0) so news fetches
 * never starve user-initiated price requests in the rate-limiter queue.
 *
 * Cache key per ticker+date ensures the cache is naturally invalidated as the
 * calendar day rolls over without manual eviction.
 */
export async function getCompanyNews(ticker: string): Promise<FinnhubNewsItem[]> {
  const upper = ticker.toUpperCase();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const cacheKey = `finnhub:news:${upper}:${today}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as FinnhubNewsItem[];

  // Finnhub requires from/to date strings
  const to   = today;
  const from = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  const data = await finnhubGet<FinnhubNewsItem[]>(
    "/company-news",
    { symbol: upper, from, to },
    PRIORITY.BACKGROUND // news fetches are background work — never starve user requests
  );

  // Finnhub may return null on unknown tickers; normalise to empty array
  const articles = Array.isArray(data) ? data : [];

  await redis.setex(cacheKey, NEWS_TTL, JSON.stringify(articles));
  return articles;
}
