import { prisma } from "@/lib/db";
import { redis } from "@/lib/cache";
import { getQuote } from "@/lib/finnhub";
import { getAssetSummary } from "@/lib/finnhub/summary";
import type {
  SignalScore,
  SignalBreakdown,
  SignalMetrics,
  SignalProjection,
  SignalDirection,
  ConfidenceLevel,
} from "@/types";

const SIGNAL_TTL = 300; // 5 min — quote data changes at most every minute

// ── Math helpers ──────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Standard normal CDF — Abramowitz & Stegun approximation (error < 7.5×10⁻⁸).
 * Used for computing P(return > 0) from a normal distribution assumption.
 */
function normalCDF(z: number): number {
  const b = [0.31938153, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  let poly = 0;
  for (let i = b.length - 1; i >= 0; i--) poly = b[i] + t * poly;
  poly *= t;
  const cdf = 1 - (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z) * poly;
  return z >= 0 ? cdf : 1 - cdf;
}

// ── Component scorers (each returns 0–100) ───────────────────────────────────

/**
 * Momentum score combines:
 *   - Today's % change (linear map of [-10%, +10%] → [0, 100])
 *   - Position within the 52-week range (near 52w high = momentum strength)
 *
 * Weight: 60% day move, 40% 52w position.
 */
function scoreMomentum(
  changePct: number,
  week52High: number | null,
  week52Low:  number | null,
  price:      number
): number {
  const dayScore = clamp(((changePct + 10) / 20) * 100, 0, 100);
  if (!week52High || !week52Low || week52High <= week52Low) return dayScore;
  const rangePos = clamp(((price - week52Low) / (week52High - week52Low)) * 100, 0, 100);
  return dayScore * 0.6 + rangePos * 0.4;
}

/**
 * Analyst consensus score combines:
 *   - Buy/Hold/Sell rating: Buy→80, Hold→50, Sell→20
 *   - Price target upside: linear map of [-30%, +30%] → [0, 100]
 *
 * Equal weighting when both are present; falls back to rating alone.
 */
function scoreAnalyst(
  analystRating: string | null,
  upsidePct:     number | null
): number {
  let recScore = 50;
  if (analystRating === "Buy")  recScore = 80;
  if (analystRating === "Hold") recScore = 50;
  if (analystRating === "Sell") recScore = 20;
  if (upsidePct === null) return recScore;
  const upsideScore = clamp(((upsidePct + 30) / 60) * 100, 0, 100);
  return recScore * 0.5 + upsideScore * 0.5;
}

/**
 * Valuation score is based on:
 *   - P/E ratio: lower = more attractive (60% weight)
 *   - PEG ratio: < 1 = undervalued relative to growth (40% weight, only when available)
 *
 * PE scoring brackets:
 *   <10: 85 | 10–15: 72 | 15–20: 60 | 20–25: 50 | 25–35: 35 | >35: 20
 * PEG scoring:
 *   <1: 80 | 1–1.5: 65 | 1.5–2: 50 | >2: 30
 */
function scoreValuation(pe: number | null, peg: number | null): number {
  let peScore = 50;
  if (pe !== null && pe > 0) {
    if      (pe < 10)  peScore = 85;
    else if (pe < 15)  peScore = 72;
    else if (pe < 20)  peScore = 60;
    else if (pe < 25)  peScore = 50;
    else if (pe < 35)  peScore = 35;
    else               peScore = 20;
  }
  if (peg === null || peg <= 0) return peScore;

  let pegScore = 50;
  if      (peg < 1)   pegScore = 80;
  else if (peg < 1.5) pegScore = 65;
  else if (peg < 2)   pegScore = 50;
  else                pegScore = 30;

  return peScore * 0.6 + pegScore * 0.4;
}

/**
 * News sentiment score derived from articles tagged with this ticker
 * in the past 7 days. Weighted by article impact (high=2, medium=1, low=0.5).
 *
 * sentimentScore is stored as [0, 1] by the news pipeline (0 = very negative,
 * 0.5 = neutral, 1 = very positive). Mapped to [0, 100], neutral at 50.
 */
async function scoreNewsSentiment(ticker: string): Promise<number> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const articles = await prisma.newsArticle.findMany({
    where: {
      tickers:        { hasSome: [ticker] },
      publishedAt:    { gte: since },
      sentimentScore: { not: null },
    },
    select: { sentimentScore: true, impact: true },
    take: 50,
  });

  if (articles.length === 0) return 50;

  let weightedSum = 0;
  let weightSum   = 0;
  for (const a of articles) {
    if (a.sentimentScore === null) continue;
    const w = a.impact === "high" ? 2 : a.impact === "medium" ? 1 : 0.5;
    weightedSum += a.sentimentScore * w;
    weightSum   += w;
  }
  if (weightSum === 0) return 50;

  // sentimentScore is stored as [0, 1] (0 = very negative, 0.5 = neutral, 1 = very positive)
  // Map directly to [0, 100]
  const avg = weightedSum / weightSum;
  return clamp(avg * 100, 0, 100);
}

// ── Core scoring ──────────────────────────────────────────────────────────────

type ScoredSignal = Omit<SignalScore, "id" | "scoredAt">;

/**
 * Scores a single ticker using quote, analyst, and news sentiment data.
 *
 * Methodology:
 *   - Momentum (35%): day % change + 52-week range position
 *   - Analyst consensus (25%): Buy/Hold/Sell rating + price target upside
 *   - Valuation (20%): P/E + PEG (PEG derived from analyst price target)
 *   - News sentiment (20%): weighted AFINN score from last 7 days
 *
 * Statistical projection uses the 52-week range as a volatility proxy:
 *   annualVol ≈ (52wHigh − 52wLow) / (2 × 1.96 × price)  [±1.96σ annual range]
 *   monthlyVol = annualVol / √12
 *   expectedReturn (monthly) = analyst upside / 12
 *   90% CI: expectedReturn ± 1.645 × monthlyVol
 *   P(positive) = Φ(expectedReturn / monthlyVol)
 *
 * Sharpe: (expected annual return − 5% risk-free rate) / annualVol
 */
export async function scoreSignalForTicker(ticker: string): Promise<ScoredSignal> {
  const upper    = ticker.toUpperCase();
  const cacheKey = `signal:${upper}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as ScoredSignal;

  const [quote, summary, sentimentScore] = await Promise.all([
    getQuote(upper, 0.5).catch(() => null),
    getAssetSummary(upper).catch(() => null),
    scoreNewsSentiment(upper),
  ]);

  if (!quote) throw new Error(`Could not fetch quote for ${upper}`);

  const price       = quote.price;
  const changePct   = quote.changePct    ?? 0;
  const pe          = quote.pe;
  const week52High  = quote.week52High;
  const week52Low   = quote.week52Low;
  const analystRating  = summary?.analystRating    ?? null;
  const analystTarget  = summary?.targetMeanPrice  ?? null;

  // Upside to analyst target
  const upsidePct = analystTarget && price > 0
    ? ((analystTarget - price) / price) * 100
    : null;

  // PEG = PE / (implied annual growth %)
  // Implied growth = analyst price target upside treated as forward 1-year growth
  const impliedGrowth = analystTarget && price > 0
    ? (analystTarget - price) / price  // as a decimal
    : null;
  const pegRatio = pe && pe > 0 && impliedGrowth && impliedGrowth > 0
    ? pe / (impliedGrowth * 100)
    : null;

  // Total return 52w proxy: gain from trough
  const totalReturn52w = week52Low && week52Low > 0
    ? ((price - week52Low) / week52Low) * 100
    : null;

  // Volatility estimate from 52w range (±1.96σ annualised → σ = range / (2×1.96×price))
  const annualVolPct = week52High && week52Low && price > 0
    ? ((week52High - week52Low) / (2 * 1.96 * price)) * 100
    : 30; // 30% vol fallback for stocks without 52w data

  const monthlyVolPct = annualVolPct / Math.sqrt(12);

  // Expected monthly return: analyst-implied annual upside / 12
  // If no analyst target, rough annualise day's move (conservative proxy)
  const annualExpectedReturn = upsidePct ?? changePct * 12;
  const monthlyExpectedReturn = annualExpectedReturn / 12;

  // Sharpe = (annualised expected return − risk-free rate) / annualVol
  const sharpeEstimate = annualVolPct > 0
    ? (annualExpectedReturn / 100 - 0.05) / (annualVolPct / 100)
    : null;

  // 90% CI projection (±1.645σ)
  const bestCasePct  = monthlyExpectedReturn + 1.645 * monthlyVolPct;
  const worstCasePct = monthlyExpectedReturn - 1.645 * monthlyVolPct;
  const probPositive = monthlyVolPct > 0
    ? normalCDF(monthlyExpectedReturn / monthlyVolPct)
    : (monthlyExpectedReturn >= 0 ? 1 : 0);

  // ── Composite scoring ──────────────────────────────────────────────────────

  const momentumValue  = scoreMomentum(changePct, week52High, week52Low, price);
  const analystValue   = scoreAnalyst(analystRating, upsidePct);
  const valuationValue = scoreValuation(pe, pegRatio);
  const sentimentValue = sentimentScore;

  const breakdown: SignalBreakdown = {
    priceMomentum:    { value: Math.round(momentumValue),  weight: 0.35 },
    analystConsensus: { value: Math.round(analystValue),   weight: 0.25 },
    valuation:        { value: Math.round(valuationValue), weight: 0.20 },
    newsSentiment:    { value: Math.round(sentimentValue), weight: 0.20 },
  };

  const compositeScore = Math.round(
    momentumValue  * 0.35 +
    analystValue   * 0.25 +
    valuationValue * 0.20 +
    sentimentValue * 0.20
  );

  const direction: SignalDirection = compositeScore >= 50 ? "bullish" : "bearish";

  const spread = Math.abs(compositeScore - 50);
  const confidence: ConfidenceLevel = spread >= 25 ? "high" : spread >= 10 ? "medium" : "low";

  const metrics: SignalMetrics = {
    totalReturn52w:  totalReturn52w  !== null ? Math.round(totalReturn52w  * 10) / 10 : null,
    sharpeEstimate:  sharpeEstimate  !== null ? Math.round(sharpeEstimate  * 100) / 100 : null,
    peRatio:         pe              !== null ? Math.round(pe              * 10) / 10 : null,
    pegRatio:        pegRatio        !== null ? Math.round(pegRatio        * 100) / 100 : null,
    analystTarget:   analystTarget   !== null ? Math.round(analystTarget   * 100) / 100 : null,
    upsidePct:       upsidePct       !== null ? Math.round(upsidePct       * 10) / 10 : null,
    analystRating,
  };

  const projection: SignalProjection = {
    horizon:           "30d",
    expectedReturnPct: Math.round(monthlyExpectedReturn * 10) / 10,
    worstCasePct:      Math.round(worstCasePct          * 10) / 10,
    bestCasePct:       Math.round(bestCasePct           * 10) / 10,
    probPositive:      Math.round(probPositive          * 1000) / 1000,
    annualVolPct:      Math.round(annualVolPct          * 10) / 10,
  };

  const result: ScoredSignal = {
    ticker: upper,
    score:  compositeScore,
    direction,
    confidence,
    breakdown,
    metrics,
    projection,
  };

  await redis.setex(cacheKey, SIGNAL_TTL, JSON.stringify(result));
  return result;
}

/**
 * Scores all tickers in a user's watchlist.
 * Results are sorted by composite score descending (highest conviction first).
 * Individual ticker failures are silently skipped.
 */
export async function getSignalsForUser(userId: string): Promise<SignalScore[]> {
  const watchlist = await prisma.watchlist.findMany({
    where:   { userId },
    select:  { ticker: true },
    orderBy: { addedAt: "desc" },
  });
  if (watchlist.length === 0) return [];

  const results = await Promise.allSettled(
    watchlist.map(({ ticker }) => scoreSignalForTicker(ticker))
  );

  const scores: SignalScore[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      scores.push({
        id:       `${watchlist[i].ticker}-signal`,
        ...r.value,
        scoredAt: new Date().toISOString(),
      });
    }
  }

  return scores.sort((a, b) => b.score - a.score);
}
