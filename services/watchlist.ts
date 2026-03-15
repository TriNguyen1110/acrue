import { prisma } from "@/lib/db";
import { redis } from "@/lib/cache";
import { getQuote, PRIORITY } from "@/lib/finnhub";
import { getWatchlistQuotes } from "@/services/marketData";
import { tickerScheduler } from "@/services/tickerScheduler";
import type { WatchlistItem, WatchlistEntry } from "@/types";

/**
 * Returns all watchlist entries for a user, enriched with live quotes.
 * Quote fetching uses the stale fallback strategy from marketData service —
 * a single failed ticker never breaks the entire watchlist response.
 */
export async function getUserWatchlist(userId: string): Promise<WatchlistItem[]> {
  const entries = await prisma.watchlist.findMany({
    where: { userId },
    orderBy: { addedAt: "desc" },
  });

  if (entries.length === 0) return [];

  const tickers = entries.map((e) => e.ticker);
  const [quotes, assets] = await Promise.all([
    getWatchlistQuotes(tickers),
    prisma.asset.findMany({
      where: { ticker: { in: tickers } },
      select: { ticker: true, sector: true },
    }),
  ]);
  const quoteMap = new Map(quotes.map((q) => [q.ticker, q]));
  const sectorMap = new Map(assets.map((a) => [a.ticker, a.sector ?? undefined]));

  return entries
    .map((entry): WatchlistItem | null => {
      const quote = quoteMap.get(entry.ticker);
      if (!quote) return null;
      return {
        id: entry.id,
        ticker: entry.ticker,
        addedAt: entry.addedAt.toISOString(),
        quote,
        sector: sectorMap.get(entry.ticker) ?? undefined,
      };
    })
    .filter((item): item is WatchlistItem => item !== null);
}

/**
 * Adds a ticker to the user's watchlist.
 *
 * Validates the ticker via a live Finnhub quote before inserting.
 * A ticker is considered invalid if both current price and previous close
 * are 0 (Finnhub's response for unknown symbols).
 *
 * After insertion, registers the ticker with tickerScheduler so it starts
 * receiving proactive per-minute refreshes.
 */
export async function addToWatchlist(
  userId: string,
  ticker: string
): Promise<WatchlistEntry> {
  const upper = ticker.toUpperCase();

  // Validate ticker exists on Finnhub
  const quote = await getQuote(upper, PRIORITY.USER);
  if (quote.price === 0 && quote.previousClose === 0) {
    throw new TickerNotFoundError(upper);
  }

  try {
    const entry = await prisma.watchlist.create({
      data: { userId, ticker: upper },
    });

    // Auto-create default alert rules for the new ticker so the user
    // starts receiving anomaly alerts without any manual configuration.
    await prisma.alertRule.createMany({
      data: [
        { userId, ticker: upper, ruleType: "price_change", threshold: 5,    cooldownMinutes: 60 },
        { userId, ticker: upper, ruleType: "volume_spike", threshold: 2.5,  cooldownMinutes: 60 },
        { userId, ticker: upper, ruleType: "volatility",   threshold: 40,   cooldownMinutes: 120 },
      ],
      skipDuplicates: true,
    });

    // Register with scheduler — starts proactive refresh for this ticker
    tickerScheduler.register(upper);

    // Enrich the asset row with sector/industry from cached profile (if available)
    // and increment watcherCount for the search recommender's popularity signal
    const cachedProfile = await redis.get(`finnhub:profile:${upper}`);
    const profile = cachedProfile ? JSON.parse(cachedProfile) : null;

    await prisma.asset.upsert({
      where: { ticker: upper },
      update: {
        watcherCount: { increment: 1 },
        ...(profile?.finnhubIndustry ? { sector: profile.finnhubIndustry } : {}),
      },
      create: {
        ticker: upper,
        name: quote.name,
        exchange: quote.exchange,
        type: "EQUITY",
        sector: profile?.finnhubIndustry ?? null,
        watcherCount: 1,
      },
    });

    return {
      id: entry.id,
      ticker: entry.ticker,
      addedAt: entry.addedAt.toISOString(),
    };
  } catch (e: unknown) {
    // Prisma unique constraint violation
    if (
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      throw new DuplicateTickerError(upper);
    }
    throw e;
  }
}

/**
 * Removes a ticker from the user's watchlist.
 * If no other users are watching that ticker, deregisters it from the scheduler.
 */
export async function removeFromWatchlist(
  userId: string,
  ticker: string
): Promise<void> {
  const upper = ticker.toUpperCase();

  const deleted = await prisma.watchlist.deleteMany({
    where: { userId, ticker: upper },
  });

  if (deleted.count === 0) throw new TickerNotFoundError(upper);

  // Deregister from scheduler only if no other users still watch this ticker
  const remaining = await prisma.watchlist.count({ where: { ticker: upper } });
  if (remaining === 0) tickerScheduler.deregister(upper);

  // Decrement watcherCount — keeps popularity signal accurate
  await prisma.asset.updateMany({
    where: { ticker: upper, watcherCount: { gt: 0 } },
    data: { watcherCount: { decrement: 1 } },
  });
}

export async function isInWatchlist(
  userId: string,
  ticker: string
): Promise<boolean> {
  const entry = await prisma.watchlist.findUnique({
    where: { userId_ticker: { userId, ticker: ticker.toUpperCase() } },
  });
  return entry !== null;
}

// ── Domain errors ─────────────────────────────────────────────────────────────

export class TickerNotFoundError extends Error {
  constructor(ticker: string) {
    super(`Ticker ${ticker} not found.`);
    this.name = "TickerNotFoundError";
  }
}

export class DuplicateTickerError extends Error {
  constructor(ticker: string) {
    super(`${ticker} is already in your watchlist.`);
    this.name = "DuplicateTickerError";
  }
}
