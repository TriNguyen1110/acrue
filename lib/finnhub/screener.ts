import { redis } from "@/lib/cache";
import { getQuotes } from "./quote";
import { PRIORITY } from "./client";
import type { Quote } from "@/types";

const SCREENER_TTL = 300; // 5 min — screener is a discovery widget, not a live feed

/**
 * S&P 100 constituent tickers used as the screener universe.
 *
 * Tradeoff: Finnhub free tier has no screener endpoint. We maintain this list
 * manually and compute gainers/losers/most-actives by sorting cached quotes.
 * The list should be updated when S&P 100 constituents change (a few times/year).
 *
 * All 100 quotes are refreshed at LOW priority via refreshScreenerUniverse(),
 * called by the background cron every 10 minutes. At 55 req/min with ~30 watchlist
 * tickers consuming MEDIUM slots, the remaining ~25 LOW slots handle this comfortably.
 */
export const SP100_TICKERS = [
  "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "GOOG", "META", "TSLA", "BRK.B", "UNH",
  "LLY", "JPM", "V", "XOM", "MA", "AVGO", "JNJ", "PG", "HD", "MRK",
  "ABBV", "CVX", "ORCL", "KO", "AMD", "BAC", "PEP", "ADBE", "TMO", "CRM",
  "NFLX", "ACN", "QCOM", "WMT", "LIN", "MCD", "DIS", "TXN", "VZ", "CSCO",
  "INTC", "IBM", "GS", "MS", "AXP", "SPGI", "NKE", "CAT", "GE", "LOW",
  "HON", "INTU", "AMGN", "SBUX", "MDLZ", "ADP", "GILD", "T", "NOW", "ISRG",
  "BLK", "ADI", "PANW", "PLD", "SYK", "MMM", "DE", "BA", "UNP", "RTX",
  "BKNG", "REGN", "ZTS", "VRTX", "CB", "ELV", "CVS", "MO", "SCHW", "SO",
  "DUK", "WM", "AON", "BSX", "ITW", "ECL", "HCA", "SHW", "CME", "PGR",
  "APD", "NSC", "FDX", "EMR", "CI", "KLAC", "MCO", "MU", "USB", "TGT",
];

export interface ScreenerResult {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  volume: number;
  marketCap: number | null;
}

function toScreenerResult(q: Quote): ScreenerResult {
  return {
    ticker: q.ticker,
    name: q.name,
    price: q.price,
    changePct: q.changePct,
    volume: q.volume,
    marketCap: q.marketCap,
  };
}

/**
 * Reads S&P 100 quote caches from Redis and computes screener results.
 * No Finnhub calls are made here — this is a pure Redis read + sort.
 * Returns empty if quotes haven't been warmed yet.
 */
async function buildScreener(): Promise<Quote[]> {
  const values = await Promise.all(
    SP100_TICKERS.map((t) => redis.get(`quote:${t}`))
  );
  return values
    .filter(Boolean)
    .map((v) => JSON.parse(v!) as Quote)
    .filter((q) => q.price > 0);
}

export async function getDayGainers(count = 10): Promise<ScreenerResult[]> {
  const key = `screener:gainers:${count}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as ScreenerResult[];

  const quotes = await buildScreener();
  const results = quotes
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, count)
    .map(toScreenerResult);

  await redis.setex(key, SCREENER_TTL, JSON.stringify(results));
  return results;
}

export async function getDayLosers(count = 10): Promise<ScreenerResult[]> {
  const key = `screener:losers:${count}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as ScreenerResult[];

  const quotes = await buildScreener();
  const results = quotes
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, count)
    .map(toScreenerResult);

  await redis.setex(key, SCREENER_TTL, JSON.stringify(results));
  return results;
}

export async function getMostActives(count = 10): Promise<ScreenerResult[]> {
  const key = `screener:actives:${count}`;
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as ScreenerResult[];

  const quotes = await buildScreener();
  const results = quotes
    .sort((a, b) => b.volume - a.volume)
    .slice(0, count)
    .map(toScreenerResult);

  await redis.setex(key, SCREENER_TTL, JSON.stringify(results));
  return results;
}

/**
 * Refreshes all S&P 100 quote caches at LOW priority.
 * Called by the background cron every 10 minutes.
 * Does not block — individual quote fetches are fire-and-forget through the rate limiter.
 */
export async function refreshScreenerUniverse(): Promise<void> {
  // getQuotes fires all requests into the LOW queue; rate limiter handles pacing
  getQuotes(SP100_TICKERS, PRIORITY.BACKGROUND).catch(() => null);
}
