import { prisma } from "@/lib/db";
import { getQuote } from "@/lib/finnhub/quote";
import type {
  SimPortfolio,
  SimHolding,
  SimPortfolioMetrics,
  CreateSimPortfolioRequest,
  AddSimHoldingRequest,
} from "@/types/simulate";

// ── Domain errors ─────────────────────────────────────────────────────────────

export class SimPortfolioNotFoundError extends Error {
  constructor(id: string) {
    super(`Simulated portfolio ${id} not found.`);
    this.name = "SimPortfolioNotFoundError";
  }
}

export class SimHoldingExistsError extends Error {
  constructor(ticker: string) {
    super(`${ticker} is already in this simulated portfolio.`);
    this.name = "SimHoldingExistsError";
  }
}

export class SimHoldingNotFoundError extends Error {
  constructor(ticker: string) {
    super(`No holding for ${ticker} in this simulated portfolio.`);
    this.name = "SimHoldingNotFoundError";
  }
}

export class TickerNotFoundError extends Error {
  constructor(ticker: string) {
    super(`Ticker not found or has no price data: ${ticker}`);
    this.name = "TickerNotFoundError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeMetrics(holdings: SimHolding[]): SimPortfolioMetrics {
  const totalStartValue   = holdings.reduce((s, h) => s + h.startValue,   0);
  const totalCurrentValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalReturnPct    =
    totalStartValue > 0
      ? ((totalCurrentValue - totalStartValue) / totalStartValue) * 100
      : 0;

  let topGainer: string | null = null;
  let topLoser:  string | null = null;

  if (holdings.length > 0) {
    const sorted = [...holdings].sort((a, b) => b.returnPct - a.returnPct);
    topGainer = sorted[0].returnPct > 0  ? sorted[0].ticker : null;
    topLoser  = sorted[sorted.length - 1].returnPct < 0 ? sorted[sorted.length - 1].ticker : null;
  }

  return { totalStartValue, totalCurrentValue, totalReturnPct, topGainer, topLoser };
}

/**
 * Enriches DB holdings with live quotes. Tolerates individual quote failures
 * by falling back to startPrice so the portfolio still renders.
 */
async function enrichHoldings(
  rows: { id: string; ticker: string; shares: number; startPrice: number }[]
): Promise<SimHolding[]> {
  const quoteResults = await Promise.allSettled(rows.map((r) => getQuote(r.ticker)));

  return rows.map((row, i) => {
    const qr = quoteResults[i];
    const currentPrice =
      qr.status === "fulfilled" && qr.value.price > 0 ? qr.value.price : row.startPrice;

    const startValue   = row.shares * row.startPrice;
    const currentValue = row.shares * currentPrice;
    const returnPct    =
      row.startPrice > 0
        ? ((currentPrice - row.startPrice) / row.startPrice) * 100
        : 0;

    return {
      id:           row.id,
      ticker:       row.ticker,
      shares:       row.shares,
      startPrice:   row.startPrice,
      currentPrice,
      startValue,
      currentValue,
      returnPct,
    };
  });
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function createSimPortfolio(
  userId: string,
  data: CreateSimPortfolioRequest
): Promise<SimPortfolio> {
  const row = await prisma.simulatedPortfolio.create({
    data: {
      userId,
      name:        data.name.trim(),
      description: data.description?.trim() ?? null,
    },
  });

  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    createdAt:   row.createdAt.toISOString(),
    holdings:    [],
    metrics:     computeMetrics([]),
  };
}

export async function getSimPortfolios(userId: string): Promise<SimPortfolio[]> {
  const rows = await prisma.simulatedPortfolio.findMany({
    where:   { userId },
    orderBy: { createdAt: "desc" },
    include: { holdings: true },
  });

  return Promise.all(
    rows.map(async (row) => {
      const holdings = await enrichHoldings(row.holdings);
      return {
        id:          row.id,
        name:        row.name,
        description: row.description,
        createdAt:   row.createdAt.toISOString(),
        holdings,
        metrics:     computeMetrics(holdings),
      };
    })
  );
}

export async function getSimPortfolio(
  userId: string,
  simPortId: string
): Promise<SimPortfolio> {
  const row = await prisma.simulatedPortfolio.findFirst({
    where:   { id: simPortId, userId },
    include: { holdings: true },
  });
  if (!row) throw new SimPortfolioNotFoundError(simPortId);

  const holdings = await enrichHoldings(row.holdings);
  return {
    id:          row.id,
    name:        row.name,
    description: row.description,
    createdAt:   row.createdAt.toISOString(),
    holdings,
    metrics:     computeMetrics(holdings),
  };
}

export async function addSimHolding(
  userId: string,
  simPortId: string,
  data: AddSimHoldingRequest
): Promise<SimHolding> {
  const upper = data.ticker.toUpperCase();

  // Verify ownership
  const sim = await prisma.simulatedPortfolio.findFirst({
    where: { id: simPortId, userId },
  });
  if (!sim) throw new SimPortfolioNotFoundError(simPortId);

  // Check duplicate
  const existing = await prisma.simulatedHolding.findUnique({
    where: { simPortId_ticker: { simPortId, ticker: upper } },
  });
  if (existing) throw new SimHoldingExistsError(upper);

  // Get live price to lock in as startPrice
  let startPrice: number;
  try {
    const quote = await getQuote(upper);
    if (!quote || quote.price === 0) throw new Error();
    startPrice = quote.price;
  } catch {
    throw new TickerNotFoundError(upper);
  }

  const row = await prisma.simulatedHolding.create({
    data: { simPortId, ticker: upper, shares: data.shares, startPrice },
  });

  return {
    id:           row.id,
    ticker:       row.ticker,
    shares:       row.shares,
    startPrice:   row.startPrice,
    currentPrice: startPrice,
    startValue:   row.shares * startPrice,
    currentValue: row.shares * startPrice,
    returnPct:    0,
  };
}

export async function removeSimHolding(
  userId: string,
  simPortId: string,
  ticker: string
): Promise<void> {
  const upper = ticker.toUpperCase();

  const sim = await prisma.simulatedPortfolio.findFirst({
    where: { id: simPortId, userId },
  });
  if (!sim) throw new SimPortfolioNotFoundError(simPortId);

  const deleted = await prisma.simulatedHolding.deleteMany({
    where: { simPortId, ticker: upper },
  });
  if (deleted.count === 0) throw new SimHoldingNotFoundError(upper);
}

export async function deleteSimPortfolio(
  userId: string,
  simPortId: string
): Promise<void> {
  const deleted = await prisma.simulatedPortfolio.deleteMany({
    where: { id: simPortId, userId },
  });
  if (deleted.count === 0) throw new SimPortfolioNotFoundError(simPortId);
}
