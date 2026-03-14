import { redis } from "@/lib/cache";
import { finnhubGet } from "./client";
import type { Candle, ChartInterval } from "@/types";

// Intraday data expires fast; daily+ data can be cached longer
const TTL_BY_INTERVAL: Record<ChartInterval, number> = {
  "1m":  60,
  "5m":  120,
  "15m": 300,
  "30m": 600,
  "1h":  1800,
  "1d":  3600,
  "1wk": 86400,
  "1mo": 86400,
};

// Finnhub uses numeric strings for intraday, letters for daily+
const RESOLUTION_MAP: Record<ChartInterval, string> = {
  "1m":  "1",
  "5m":  "5",
  "15m": "15",
  "30m": "30",
  "1h":  "60",
  "1d":  "D",
  "1wk": "W",
  "1mo": "M",
};

interface FinnhubCandles {
  c: number[];  // close
  h: number[];  // high
  l: number[];  // low
  o: number[];  // open
  t: number[];  // unix timestamps
  v: number[];  // volume
  s: "ok" | "no_data";
}

function toUnix(d: Date | string): number {
  return Math.floor(new Date(d).getTime() / 1000);
}

export async function getChart(
  ticker: string,
  interval: ChartInterval = "1d",
  period1: Date | string = "2024-01-01",
  period2: Date | string = new Date()
): Promise<Candle[]> {
  const upper = ticker.toUpperCase();
  const from = toUnix(period1);
  const to = toUnix(period2);
  const cacheKey = `chart:${upper}:${interval}:${from}:${to}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as Candle[];

  const data = await finnhubGet<FinnhubCandles>(
    "/stock/candle",
    {
      symbol: upper,
      resolution: RESOLUTION_MAP[interval],
      from: String(from),
      to: String(to),
    },
    "low" // candle fetches are background work
  );

  if (data.s === "no_data" || !data.c?.length) {
    await redis.setex(cacheKey, TTL_BY_INTERVAL[interval], JSON.stringify([]));
    return [];
  }

  const candles: Candle[] = data.t.map((ts, i) => ({
    date: new Date(ts * 1000).toISOString(),
    open: data.o[i],
    high: data.h[i],
    low: data.l[i],
    close: data.c[i],
    volume: data.v[i],
  }));

  await redis.setex(cacheKey, TTL_BY_INTERVAL[interval], JSON.stringify(candles));
  return candles;
}

// Last N days of daily closes — used for sparklines and signal scoring
export async function getDailyCloses(
  ticker: string,
  days = 30
): Promise<{ date: string; close: number }[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const candles = await getChart(ticker, "1d", from);
  return candles.map((c) => ({ date: c.date, close: c.close }));
}

// Last N days of daily volumes — used for volume anomaly detection
export async function getDailyVolumes(
  ticker: string,
  days = 30
): Promise<{ date: string; volume: number }[]> {
  const from = new Date();
  from.setDate(from.getDate() - days);
  const candles = await getChart(ticker, "1d", from);
  return candles.map((c) => ({ date: c.date, volume: c.volume }));
}
