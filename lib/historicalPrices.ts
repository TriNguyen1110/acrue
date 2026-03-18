import { redis } from "@/lib/cache";

const HIST_TTL = 86400; // 24h — daily closes change at most once per trading day

export interface DailyClose {
  date:  string; // YYYY-MM-DD
  close: number;
}

/**
 * Fetches 1 year of daily closing prices from Yahoo Finance's public chart API.
 * No API key required. Cached for 24 hours in Redis.
 *
 * Endpoint: https://query2.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1y
 */
export async function getDailyCloses(ticker: string): Promise<DailyClose[]> {
  const upper    = ticker.toUpperCase();
  const cacheKey = `yf:closes:${upper}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as DailyClose[];

  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${upper}?interval=1d&range=1y`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo Finance fetch failed for ${upper}: ${res.status}`);

  interface YFResponse {
    chart: {
      result?: Array<{
        timestamp: number[];
        indicators: { quote: Array<{ close: (number | null)[] }> };
      }>;
    };
  }

  const json = (await res.json()) as YFResponse;
  const result = json.chart.result?.[0];
  if (!result?.timestamp?.length) return [];

  const timestamps  = result.timestamp;
  const closePrices = result.indicators.quote[0].close;

  const closes: DailyClose[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closePrices[i];
    if (c !== null && c > 0) {
      closes.push({
        date:  new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        close: c,
      });
    }
  }

  await redis.setex(cacheKey, HIST_TTL, JSON.stringify(closes));
  return closes;
}

/**
 * Computes daily log returns: ln(P_t / P_{t-1}).
 * Matches the formula used in the Python reference project.
 */
export function computeLogReturns(closes: DailyClose[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1].close > 0) {
      returns.push(Math.log(closes[i].close / closes[i - 1].close));
    }
  }
  return returns;
}

/**
 * Builds an annualised covariance matrix (×252 trading days) from return series.
 *
 * For any pair where real return data is unavailable or too short (<20 observations),
 * falls back to a synthetic entry using the 52w-range vol proxy and ρ = 0.3 correlation.
 *
 * returnSeries[i] = null means no data was available for ticker i.
 * fallbackSigmas[i] = annualised vol estimate for ticker i (from 52w range proxy).
 */
export function buildCovarianceMatrix(
  returnSeries:   (number[] | null)[],
  fallbackSigmas: number[]
): number[][] {
  const n   = returnSeries.length;
  const cov = Array.from({ length: n }, () => Array<number>(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      const ri = returnSeries[i];
      const rj = returnSeries[j];

      if (ri && rj && ri.length >= 20 && rj.length >= 20) {
        // Align series lengths — take the most recent overlapping window
        const len  = Math.min(ri.length, rj.length);
        const a    = ri.slice(ri.length - len);
        const b    = rj.slice(rj.length - len);
        const meanA = a.reduce((s, x) => s + x, 0) / len;
        const meanB = b.reduce((s, x) => s + x, 0) / len;

        let sumCov = 0;
        for (let k = 0; k < len; k++) sumCov += (a[k] - meanA) * (b[k] - meanB);

        // Annualise: daily cov × 252 trading days
        const entry = (sumCov / (len - 1)) * 252;
        cov[i][j]   = entry;
        cov[j][i]   = entry;
      } else {
        // Fallback synthetic entry
        const entry = i === j
          ? fallbackSigmas[i] * fallbackSigmas[i]
          : 0.3 * fallbackSigmas[i] * fallbackSigmas[j];
        cov[i][j] = entry;
        cov[j][i] = entry;
      }
    }
  }

  return cov;
}
