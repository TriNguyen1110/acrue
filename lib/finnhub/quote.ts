import { redis } from "@/lib/cache";
import { finnhubGet, PRIORITY } from "./client";
import type { Quote } from "@/types";

const QUOTE_TTL = 60;      // 1 min — live price data
const PROFILE_TTL = 86400; // 24h  — name, exchange, sector rarely change
const METRICS_TTL = 21600; // 6h   — EPS, 52w range, avg volume update infrequently

// ── Finnhub response shapes ───────────────────────────────────────────────────

interface FinnhubQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // change percent
  h: number;   // day high
  l: number;   // day low
  o: number;   // day open
  pc: number;  // previous close
  t: number;   // unix timestamp
}

interface FinnhubProfile {
  name: string;
  exchange: string;
  currency: string;
  finnhubIndustry: string;
  marketCapitalization: number; // in millions USD
  weburl: string;
  country: string;
}

interface FinnhubMetricData {
  "52WeekHigh": number;
  "52WeekLow": number;
  "10DayAverageTradingVolume": number; // in millions
  epsTTM: number | null;
}

// ── Sub-fetchers with their own caches ────────────────────────────────────────

async function fetchProfile(ticker: string): Promise<FinnhubProfile | null> {
  const key = `finnhub:profile:${ticker}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as FinnhubProfile;

  const data = await finnhubGet<FinnhubProfile>(
    "/stock/profile2",
    { symbol: ticker },
    PRIORITY.BACKGROUND // profile is slow-changing; background priority is fine
  );
  if (!data?.name) return null;

  await redis.setex(key, PROFILE_TTL, JSON.stringify(data));
  return data;
}

async function fetchMetrics(ticker: string): Promise<FinnhubMetricData | null> {
  const key = `finnhub:metrics:${ticker}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as FinnhubMetricData;

  const data = await finnhubGet<{ metric: FinnhubMetricData }>(
    "/stock/metric",
    { symbol: ticker, metric: "all" },
    PRIORITY.BACKGROUND
  );
  if (!data?.metric) return null;

  await redis.setex(key, METRICS_TTL, JSON.stringify(data.metric));
  return data.metric;
}

// ── Market state from current Eastern time ───────────────────────────────────

function getMarketState(): Quote["marketState"] {
  const et = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const day = et.getDay(); // 0 = Sun, 6 = Sat
  const t = et.getHours() * 60 + et.getMinutes();

  if (day === 0 || day === 6) return "CLOSED";
  if (t >= 570 && t < 960) return "REGULAR";  // 9:30–16:00
  if (t >= 240 && t < 570) return "PRE";       // 4:00–9:30
  if (t >= 960 && t < 1200) return "POST";     // 16:00–20:00
  return "CLOSED";
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetches a live quote for a single ticker.
 *
 * Combines three Finnhub endpoints, each cached independently:
 *   /quote           → price data     (60s TTL, medium priority)
 *   /stock/profile2  → company meta   (24h TTL, low priority)
 *   /stock/metric    → fundamentals   (6h  TTL, low priority)
 *
 * On a per-minute refresh cycle only /quote costs an API token; profile and
 * metrics are almost always served from Redis.
 *
 * Note: `volume` (today's accumulated volume) is not returned by Finnhub's
 * /quote endpoint. It is set to 0 here and populated via candle data when
 * chart.ts fetches intraday bars. The tickerScheduler handles this gracefully
 * by scoring volumeSpike as 0 when volume is unavailable.
 *
 * After a successful fetch, `ticker:last_fetched` is updated in Redis so the
 * tickerScheduler can compute staleness scores accurately.
 */
export async function getQuote(
  ticker: string,
  score: number = 0.5
): Promise<Quote> {
  const upper = ticker.toUpperCase();
  const cacheKey = `quote:${upper}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as Quote;

  const [raw, profile, metrics] = await Promise.all([
    finnhubGet<FinnhubQuote>("/quote", { symbol: upper }, score),
    fetchProfile(upper),
    fetchMetrics(upper),
  ]);

  const pe =
    metrics?.epsTTM && metrics.epsTTM > 0 ? raw.c / metrics.epsTTM : null;

  const quote: Quote = {
    ticker: upper,
    name: profile?.name ?? upper,
    price: raw.c,
    change: raw.d,
    changePct: raw.dp,
    volume: 0, // not in Finnhub /quote — populated by chart.ts intraday candles
    avgVolume: metrics?.["10DayAverageTradingVolume"]
      ? metrics["10DayAverageTradingVolume"] * 1_000_000
      : 0,
    marketCap: profile?.marketCapitalization
      ? profile.marketCapitalization * 1_000_000
      : null,
    pe,
    week52High: metrics?.["52WeekHigh"] ?? null,
    week52Low: metrics?.["52WeekLow"] ?? null,
    dayHigh: raw.h,
    dayLow: raw.l,
    open: raw.o,
    previousClose: raw.pc,
    marketState: getMarketState(),
    exchange: profile?.exchange ?? "",
    currency: profile?.currency ?? "USD",
    quoteType: "EQUITY",
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    redis.setex(cacheKey, QUOTE_TTL, JSON.stringify(quote)),
    redis.hset("ticker:last_fetched", upper, Date.now().toString()),
  ]);

  return quote;
}

export async function getQuotes(
  tickers: string[],
  score: number = 0.5
): Promise<Quote[]> {
  if (tickers.length === 0) return [];
  return Promise.all(tickers.map((t) => getQuote(t, score)));
}
