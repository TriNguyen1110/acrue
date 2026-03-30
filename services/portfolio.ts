import { prisma } from "@/lib/db";
import { redis } from "@/lib/cache";
import { getQuote } from "@/lib/finnhub/quote";
import { getAssetSummary } from "@/lib/finnhub/summary";
import { getDailyCloses, computeLogReturns, buildCovarianceMatrix } from "@/lib/historicalPrices";
import type {
  PortfolioHolding,
  PortfolioMetrics,
  PortfolioResponse,
  OptimizeResponse,
  RiskProfile,
} from "@/types/portfolio";

// ── Domain errors ─────────────────────────────────────────────────────────────

export class DuplicateHoldingError extends Error {
  constructor(ticker: string) {
    super(`Holding already exists for ticker: ${ticker}`);
    this.name = "DuplicateHoldingError";
  }
}

export class HoldingNotFoundError extends Error {
  constructor(ticker: string) {
    super(`No holding found for ticker: ${ticker}`);
    this.name = "HoldingNotFoundError";
  }
}

export class TickerNotFoundError extends Error {
  constructor(ticker: string) {
    super(`Ticker not found or has no price data: ${ticker}`);
    this.name = "TickerNotFoundError";
  }
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

const PORTFOLIO_TTL = 60; // 1 minute

function cacheKey(userId: string): string {
  return `portfolio:${userId}`;
}

async function invalidateCache(userId: string): Promise<void> {
  await redis.del(cacheKey(userId));
}

// ── Math utilities ─────────────────────────────────────────────────────────────

/**
 * Projects weights onto the probability simplex {w >= 0, sum(w) = 1}.
 * Implements Duchi et al. (2008) Algorithm 1.
 */
function projectToSimplex(v: number[]): number[] {
  const n = v.length;
  const u = [...v].sort((a, b) => b - a);
  let cumsum = 0;
  let rho = 0;
  for (let i = 0; i < n; i++) {
    cumsum += u[i];
    if (u[i] - (cumsum - 1) / (i + 1) > 0) rho = i;
  }
  const theta =
    (u.slice(0, rho + 1).reduce((s, x) => s + x, 0) - 1) / (rho + 1);
  return v.map((x) => Math.max(0, x - theta));
}

/**
 * Computes portfolio return given weights and individual expected returns.
 */
function portfolioReturn(weights: number[], mus: number[]): number {
  return weights.reduce((sum, w, i) => sum + w * mus[i], 0);
}

/**
 * Computes portfolio variance using a real covariance matrix: σ²_p = w^T Σ w.
 * Used by the optimizer with the Yahoo Finance–derived covariance matrix.
 */
function portfolioVarianceMatrix(weights: number[], cov: number[][]): number {
  let variance = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      variance += weights[i] * weights[j] * cov[i][j];
    }
  }
  return Math.max(0, variance);
}

/**
 * Gradient of U = μ_p - A × σ²_p with respect to wᵢ using real covariance.
 * ∂U/∂wᵢ = μᵢ - 2A × (Σw)ᵢ  where (Σw)ᵢ = Σⱼ Σᵢⱼ wⱼ
 */
function utilityGradientMatrix(
  weights: number[],
  mus:     number[],
  cov:     number[][],
  A:       number
): number[] {
  return weights.map((_, i) => {
    const covW = cov[i].reduce((sum, c, j) => sum + c * weights[j], 0);
    return mus[i] - 2 * A * covW;
  });
}

/**
 * Computes portfolio variance using equal pairwise correlation rho = 0.3.
 * Used by computePortfolioMetrics (fast path — no Yahoo Finance fetch needed).
 * σ²_p = (1 - ρ) × Σᵢ wᵢ² σᵢ² + ρ × (Σᵢ wᵢ σᵢ)²
 */
function portfolioVariance(weights: number[], sigmas: number[], rho = 0.3): number {
  const diagTerm  = weights.reduce((sum, w, i) => sum + w * w * sigmas[i] * sigmas[i], 0);
  const crossTerm = weights.reduce((sum, w, i) => sum + w * sigmas[i], 0);
  return (1 - rho) * diagTerm + rho * crossTerm * crossTerm;
}

// ── Metrics computation ───────────────────────────────────────────────────────

interface HoldingWithMeta {
  ticker: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  week52High: number | null;
  week52Low: number | null;
  changePct: number;
  analystTarget: number | null;
  updatedAt: string;
}

function computePortfolioMetrics(holdings: HoldingWithMeta[]): PortfolioMetrics {
  const totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);

  if (totalValue === 0 || holdings.length === 0) {
    return {
      expectedReturn: 0,
      volatility: 0,
      sharpeRatio: 0,
      diversificationScore: 0,
    };
  }

  const weights = holdings.map((h) => h.marketValue / totalValue);

  // Individual annual volatility from 52w range proxy
  const sigmas = holdings.map((h) => {
    if (
      h.week52High !== null &&
      h.week52Low !== null &&
      h.currentPrice > 0
    ) {
      return (h.week52High - h.week52Low) / (2 * 1.96 * h.currentPrice);
    }
    return 0.3; // fallback: 30% annualised vol
  });

  // Individual expected annual return
  const mus = holdings.map((h) => {
    if (h.analystTarget !== null && h.currentPrice > 0) {
      return (h.analystTarget - h.currentPrice) / h.currentPrice;
    }
    // No analyst target cached — derive from 52w range: deviation from midpoint
    // gives a momentum-adjusted annual return estimate without annualizing noise
    if (h.week52High !== null && h.week52Low !== null && h.week52High > h.week52Low) {
      const midpoint = (h.week52High + h.week52Low) / 2;
      return (h.currentPrice - midpoint) / midpoint;
    }
    return h.changePct / 100;
  });

  const mu_p = portfolioReturn(weights, mus);
  const sigma2_p = portfolioVariance(weights, sigmas);
  const sigma_p = Math.sqrt(sigma2_p);

  const RISK_FREE = 0.05;
  const sharpeRatio = sigma_p > 0 ? (mu_p - RISK_FREE) / sigma_p : 0;

  // Herfindahl diversification score
  const hhi = weights.reduce((s, w) => s + w * w, 0);
  const diversificationScore = Math.round((1 - hhi) * 100);

  return {
    expectedReturn: mu_p,
    volatility: sigma_p,
    sharpeRatio,
    diversificationScore,
  };
}

// ── Holdings CRUD ─────────────────────────────────────────────────────────────

export async function addHolding(
  userId: string,
  {
    ticker,
    shares,
    avgCost,
  }: { ticker: string; shares: number; avgCost: number }
): Promise<PortfolioHolding> {
  const upper = ticker.toUpperCase();

  // Validate ticker via live quote
  let quote;
  try {
    quote = await getQuote(upper);
  } catch {
    throw new TickerNotFoundError(upper);
  }
  if (!quote || quote.price === 0) {
    throw new TickerNotFoundError(upper);
  }

  // Check for duplicate
  const existing = await prisma.portfolioHolding.findUnique({
    where: { userId_ticker: { userId, ticker: upper } },
  });
  if (existing) throw new DuplicateHoldingError(upper);

  const row = await prisma.portfolioHolding.create({
    data: { userId, ticker: upper, shares, avgCost },
  });

  await invalidateCache(userId);

  const marketValue = shares * quote.price;
  const pnl = marketValue - shares * avgCost;
  const pnlPct = avgCost > 0 ? ((quote.price - avgCost) / avgCost) * 100 : 0;

  const annualVolPct =
    quote.week52High !== null && quote.week52Low !== null && quote.price > 0
      ? Math.round(((quote.week52High - quote.week52Low) / (2 * 1.96 * quote.price)) * 1000) / 10
      : null;

  return {
    id: row.id,
    ticker: row.ticker,
    shares: row.shares,
    avgCost: row.avgCost,
    currentPrice: quote.price,
    marketValue,
    pnl,
    pnlPct,
    annualVolPct,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updateHolding(
  userId: string,
  ticker: string,
  updates: { shares?: number; avgCost?: number }
): Promise<void> {
  const upper = ticker.toUpperCase();

  const existing = await prisma.portfolioHolding.findUnique({
    where: { userId_ticker: { userId, ticker: upper } },
  });
  if (!existing) throw new HoldingNotFoundError(upper);

  await prisma.portfolioHolding.update({
    where: { userId_ticker: { userId, ticker: upper } },
    data: {
      ...(updates.shares !== undefined ? { shares: updates.shares } : {}),
      ...(updates.avgCost !== undefined ? { avgCost: updates.avgCost } : {}),
    },
  });

  await invalidateCache(userId);
}

export async function removeHolding(
  userId: string,
  ticker: string
): Promise<void> {
  const upper = ticker.toUpperCase();

  const existing = await prisma.portfolioHolding.findUnique({
    where: { userId_ticker: { userId, ticker: upper } },
  });
  if (!existing) throw new HoldingNotFoundError(upper);

  await prisma.portfolioHolding.delete({
    where: { userId_ticker: { userId, ticker: upper } },
  });

  await invalidateCache(userId);
}

// ── Portfolio data ────────────────────────────────────────────────────────────

export async function getPortfolio(userId: string): Promise<PortfolioResponse> {
  // Check cache first
  const cached = await redis.get(cacheKey(userId));
  if (cached) return JSON.parse(cached) as PortfolioResponse;

  const dbHoldings = await prisma.portfolioHolding.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  if (dbHoldings.length === 0) {
    return {
      holdings: [],
      metrics: {
        expectedReturn: 0,
        volatility: 0,
        sharpeRatio: 0,
        diversificationScore: 0,
      },
      totalValue: 0,
      totalPnl: 0,
      totalPnlPct: 0,
    };
  }

  // Fetch quotes + cached summaries for all tickers in parallel
  // Summaries are Redis-only reads (no API calls) — TTL 6h, populated when tickers are viewed
  const [quoteResults, summaryResults] = await Promise.all([
    Promise.allSettled(dbHoldings.map((h) => getQuote(h.ticker))),
    Promise.allSettled(
      dbHoldings.map((h) =>
        redis.get(`summary:${h.ticker.toUpperCase()}`).then((raw) =>
          raw ? (JSON.parse(raw) as { targetMeanPrice: number | null }) : null
        )
      )
    ),
  ]);

  const holdingsWithMeta: HoldingWithMeta[] = [];

  for (let i = 0; i < dbHoldings.length; i++) {
    const row = dbHoldings[i];
    const result = quoteResults[i];

    const quote =
      result.status === "fulfilled" && result.value.price > 0
        ? result.value
        : null;

    const summary =
      summaryResults[i].status === "fulfilled" ? summaryResults[i].value : null;

    const currentPrice = quote?.price ?? row.avgCost; // fallback to avgCost if quote failed
    const marketValue = row.shares * currentPrice;
    const pnl = marketValue - row.shares * row.avgCost;
    const pnlPct =
      row.avgCost > 0
        ? ((currentPrice - row.avgCost) / row.avgCost) * 100
        : 0;

    holdingsWithMeta.push({
      ticker: row.ticker,
      shares: row.shares,
      avgCost: row.avgCost,
      currentPrice,
      marketValue,
      pnl,
      pnlPct,
      week52High: quote?.week52High ?? null,
      week52Low: quote?.week52Low ?? null,
      changePct: quote?.changePct ?? 0,
      analystTarget: summary?.targetMeanPrice ?? null,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  const totalValue = holdingsWithMeta.reduce((s, h) => s + h.marketValue, 0);
  const totalPnl = holdingsWithMeta.reduce((s, h) => s + h.pnl, 0);
  const totalCost = dbHoldings.reduce(
    (s, h) => s + h.shares * h.avgCost,
    0
  );
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const metrics = computePortfolioMetrics(holdingsWithMeta);

  const response: PortfolioResponse = {
    holdings: holdingsWithMeta.map((h) => {
      const annualVolPct =
        h.week52High !== null && h.week52Low !== null && h.currentPrice > 0
          ? Math.round(
              ((h.week52High - h.week52Low) / (2 * 1.96 * h.currentPrice)) * 1000
            ) / 10  // one decimal place as a %
          : null;
      return {
        id: dbHoldings.find((r) => r.ticker === h.ticker)!.id,
        ticker: h.ticker,
        shares: h.shares,
        avgCost: h.avgCost,
        currentPrice: h.currentPrice,
        marketValue: h.marketValue,
        pnl: h.pnl,
        pnlPct: h.pnlPct,
        annualVolPct,
        updatedAt: h.updatedAt,
      };
    }),
    metrics,
    totalValue,
    totalPnl,
    totalPnlPct,
  };

  await redis.setex(cacheKey(userId), PORTFOLIO_TTL, JSON.stringify(response));
  return response;
}

// ── Portfolio optimization ────────────────────────────────────────────────────

const RISK_AVERSION: Record<RiskProfile, number> = {
  conservative: 10,
  moderate: 3,
  aggressive: 1,
};

export async function optimizePortfolio(
  userId: string,
  riskProfile: RiskProfile
): Promise<OptimizeResponse> {
  const dbHoldings = await prisma.portfolioHolding.findMany({
    where: { userId },
  });

  if (dbHoldings.length === 0) {
    return {
      suggestedWeights: {},
      projectedReturn: 0,
      projectedVolatility: 0,
      method: "mean_variance",
    };
  }

  const tickers = dbHoldings.map((h) => h.ticker);

  // Fetch quotes + analyst targets in parallel; tolerate individual failures
  const [quoteResults, summaryResults] = await Promise.all([
    Promise.allSettled(tickers.map((t) => getQuote(t))),
    Promise.allSettled(tickers.map((t) => getAssetSummary(t))),
  ]);

  // Build per-asset mu and sigma arrays
  const n = tickers.length;
  const mus: number[] = [];
  const sigmas: number[] = [];
  const validTickers: string[] = [];

  for (let i = 0; i < n; i++) {
    const qResult = quoteResults[i];
    const sResult = summaryResults[i];

    const quote =
      qResult.status === "fulfilled" && qResult.value.price > 0
        ? qResult.value
        : null;
    if (!quote) continue; // skip this asset if no price data

    const summary =
      sResult.status === "fulfilled" ? sResult.value : null;

    // Annual vol proxy from 52w range
    const sigma =
      quote.week52High !== null &&
      quote.week52Low !== null &&
      quote.price > 0
        ? (quote.week52High - quote.week52Low) / (2 * 1.96 * quote.price)
        : 0.3;

    // Expected annual return
    // Analyst target upside is the preferred signal — more stable than a single day's move.
    // Fallback annualises today's changePct, but a single day is very noisy so we clamp
    // both paths to [-50%, +150%] to prevent the optimizer receiving garbage input
    // (e.g. a -8% after-hours quote annualises to -2016%, collapsing weights to one ticker).
    const analystTarget = summary?.targetMeanPrice ?? null;
    let mu: number;
    if (analystTarget !== null && quote.price > 0) {
      mu = (analystTarget - quote.price) / quote.price;
    } else {
      mu = (quote.changePct / 100) * 252;
    }
    mu = Math.max(-0.5, Math.min(1.5, mu)); // clamp to sane annual return range

    mus.push(mu);
    sigmas.push(sigma);
    validTickers.push(tickers[i]);
  }

  if (validTickers.length === 0) {
    return {
      suggestedWeights: {},
      projectedReturn: 0,
      projectedVolatility: 0,
      method: "mean_variance",
    };
  }

  // ── Real covariance matrix from Yahoo Finance historical prices ──────────────
  // Fetch 1 year of daily closes for each ticker; tolerate individual failures.
  // Cached 24h in Redis — data changes at most once per trading day.
  const closeResults = await Promise.allSettled(
    validTickers.map((t) => getDailyCloses(t))
  );

  const returnSeries: (number[] | null)[] = closeResults.map((r) =>
    r.status === "fulfilled" && r.value.length >= 20
      ? computeLogReturns(r.value)
      : null
  );

  // Build covariance matrix; falls back to synthetic entries (ρ=0.3) for any
  // ticker where Yahoo Finance data was unavailable.
  const covMatrix = buildCovarianceMatrix(returnSeries, sigmas);

  // ── Projected gradient ascent on U = μ_p - A × σ²_p ─────────────────────────
  const A          = RISK_AVERSION[riskProfile];
  const ITERATIONS = 500;
  const LR         = 0.01;

  let weights = Array<number>(validTickers.length).fill(1 / validTickers.length);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const grad    = utilityGradientMatrix(weights, mus, covMatrix, A);
    const stepped = weights.map((w, i) => w + LR * grad[i]);
    weights       = projectToSimplex(stepped);
  }

  const suggestedWeights: Record<string, number> = {};
  validTickers.forEach((t, i) => { suggestedWeights[t] = weights[i]; });

  const projectedReturn     = portfolioReturn(weights, mus);
  const projectedVolatility = Math.sqrt(portfolioVarianceMatrix(weights, covMatrix));

  return {
    suggestedWeights,
    projectedReturn,
    projectedVolatility,
    method: "mean_variance",
  };
}
