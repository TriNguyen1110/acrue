import { redis } from "@/lib/cache";
import {
  getQuote,
  getChart,
  getDayGainers,
  getDayLosers,
  getMostActives,
} from "@/lib/finnhub";
import type { Quote, Candle, ChartInterval } from "@/types";
import type { ScreenerResult } from "@/lib/finnhub/screener";

// ── Caching ───────────────────────────────────────────────────────────────────

// Service-level cache for derived/computed values (on top of lib-level caches)
const RETURNS_TTL = 3600;   // 1h — log returns change slowly intraday
const OVERVIEW_TTL = 300;   // 5 min — dashboard market overview

// ── Market status ─────────────────────────────────────────────────────────────

export interface MarketStatus {
  state: Quote["marketState"];
  isOpen: boolean;
  asOf: string; // ISO timestamp
}

export function getMarketStatus(): MarketStatus {
  const et = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = et.getDay();
  const t = et.getHours() * 60 + et.getMinutes();

  let state: Quote["marketState"];
  if (day === 0 || day === 6) {
    state = "CLOSED";
  } else if (t >= 570 && t < 960) {
    state = "REGULAR";
  } else if (t >= 240 && t < 570) {
    state = "PRE";
  } else if (t >= 960 && t < 1200) {
    state = "POST";
  } else {
    state = "CLOSED";
  }

  return {
    state,
    isOpen: state === "REGULAR",
    asOf: new Date().toISOString(),
  };
}

// ── Watchlist quotes with stale fallback ──────────────────────────────────────

/**
 * Fetches live quotes for all watchlist tickers.
 *
 * Graceful degradation: if a live fetch fails for a ticker (Finnhub error,
 * rate limit, network issue), we serve the last cached value from Redis rather
 * than failing the entire watchlist response. The stale quote retains its
 * original `updatedAt` so the UI can surface a staleness indicator.
 *
 * Tickers with no cached data at all are silently omitted from the result.
 */
export async function getWatchlistQuotes(tickers: string[]): Promise<Quote[]> {
  if (tickers.length === 0) return [];

  const results = await Promise.all(
    tickers.map(async (ticker): Promise<Quote | null> => {
      const upper = ticker.toUpperCase();
      try {
        return await getQuote(upper, "high");
      } catch {
        // Live fetch failed — try to serve stale cached data
        const stale = await redis.get(`quote:${upper}`);
        return stale ? (JSON.parse(stale) as Quote) : null;
      }
    })
  );

  return results.filter((q): q is Quote => q !== null);
}

// ── Price and volume series ───────────────────────────────────────────────────

/**
 * Returns an array of daily close prices for the last N days.
 * Used by signal scoring (momentum, EMA crossover, rolling volatility).
 */
export async function getClosePrices(
  ticker: string,
  days = 30
): Promise<number[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const candles = await getChart(ticker, "1d", from);
  return candles.map((c) => c.close);
}

/**
 * Returns an array of daily volumes for the last N days.
 * Used by alert detection (volume z-score) and signal scoring (volume anomaly).
 */
export async function getVolumeArray(
  ticker: string,
  days = 30
): Promise<number[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const candles = await getChart(ticker, "1d", from);
  return candles.map((c) => c.volume);
}

/**
 * Returns daily log returns: ln(price_t / price_t-1) for each trading day.
 * Used by portfolio service for covariance matrix and expected return calculations.
 *
 * Cached at service level (1h TTL) since computing returns from candles on every
 * portfolio call would be redundant — the underlying candle data changes at most
 * once per day.
 *
 * Defaults to 252 trading days (~1 year), the standard window for annualised metrics.
 */
export async function getDailyReturns(
  ticker: string,
  days = 252
): Promise<number[]> {
  const upper = ticker.toUpperCase();
  const cacheKey = `returns:${upper}:${days}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as number[];

  // Fetch one extra day so we have N return periods from N+1 price points
  const closes = await getClosePrices(upper, days + 1);
  if (closes.length < 2) return [];

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
  }

  await redis.setex(cacheKey, RETURNS_TTL, JSON.stringify(returns));
  return returns;
}

// ── Historical candles ────────────────────────────────────────────────────────

/**
 * Returns full OHLCV candles for a long historical window.
 *
 * The `to` date is normalised to the start of today (midnight UTC) so that
 * repeated calls within the same day always hit the same cache key in
 * lib/finnhub/chart.ts. Without this, every call with `new Date()` would
 * generate a different cache key due to the unix timestamp precision.
 *
 * Used by portfolio service for Monte Carlo simulation and covariance matrix.
 */
export async function getHistoricalCandles(
  ticker: string,
  days = 730 // 2 years default — covers covariance + Monte Carlo needs
): Promise<Candle[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);

  // Normalise `to` to start of today for cache stability
  const to = new Date();
  to.setHours(0, 0, 0, 0);

  return getChart(ticker, "1d", from, to);
}

/**
 * Returns recent intraday candles for anomaly/alert detection.
 * Defaults to the last 2 hours at 5-min resolution.
 */
export async function getIntradayCandles(
  ticker: string,
  interval: ChartInterval = "5m",
  hoursBack = 2
): Promise<Candle[]> {
  const from = new Date();
  from.setHours(from.getHours() - hoursBack);
  return getChart(ticker, interval, from);
}

// ── Market overview ───────────────────────────────────────────────────────────

export interface MarketOverview {
  gainers: ScreenerResult[];
  losers: ScreenerResult[];
  actives: ScreenerResult[];
  asOf: string;
}

/**
 * Returns top gainers, losers, and most actives from the S&P 100 universe.
 * Cached at service level to avoid re-sorting on every dashboard load.
 */
export async function getMarketOverview(count = 5): Promise<MarketOverview> {
  const cacheKey = `overview:${count}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as MarketOverview;

  const [gainers, losers, actives] = await Promise.all([
    getDayGainers(count),
    getDayLosers(count),
    getMostActives(count),
  ]);

  const overview: MarketOverview = {
    gainers,
    losers,
    actives,
    asOf: new Date().toISOString(),
  };

  await redis.setex(cacheKey, OVERVIEW_TTL, JSON.stringify(overview));
  return overview;
}
