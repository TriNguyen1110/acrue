import { prisma } from "@/lib/db";
import type { AssetSearchResult } from "@/types";

/**
 * Tag-based asset search against the local assets table.
 *
 * Ranking (highest first):
 *   4 — exact ticker match          (AAPL → AAPL)
 *   3 — ticker starts with query    (APP → AAPL, APPL...)
 *   2 — name starts with query      (apple → Apple Inc)
 *   1 — ticker or name contains it  (pay → PayPal, Paychex...)
 *
 * Within the same rank, rows sorted by watcherCount DESC.
 *
 * If userId is provided, results are annotated with `diversifies: true`
 * when the ticker's sector is absent or underrepresented in the user's
 * current watchlist — surfacing picks that would broaden their exposure.
 *
 * Results capped at 10.
 */
export async function searchAssets(
  query: string,
  userId?: string
): Promise<AssetSearchResult[]> {
  if (!query || query.trim().length < 1) return [];

  const q = query.trim();

  const [rows, watchlistSectors] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        ticker: string;
        name: string;
        exchange: string;
        type: string;
        sector: string | null;
        industry: string | null;
      }>
    >`
      SELECT ticker, name, exchange, type, sector, industry
      FROM "Asset"
      WHERE
        UPPER(ticker) LIKE '%' || UPPER(${q}) || '%'
        OR UPPER(name) LIKE '%' || UPPER(${q}) || '%'
      ORDER BY
        CASE
          WHEN UPPER(ticker) = UPPER(${q})             THEN 4
          WHEN UPPER(ticker) LIKE UPPER(${q}) || '%'   THEN 3
          WHEN UPPER(name)   LIKE UPPER(${q}) || '%'   THEN 2
          ELSE 1
        END DESC,
        "watcherCount" DESC
      LIMIT 10
    `,

    // Fetch existing watchlist sector distribution for this user (if authed)
    userId
      ? prisma.$queryRaw<Array<{ sector: string | null }>>`
          SELECT a.sector
          FROM "Watchlist" w
          JOIN "Asset" a ON a.ticker = w.ticker
          WHERE w."userId" = ${userId}
        `
      : Promise.resolve([] as Array<{ sector: string | null }>),
  ]);

  // Build a set of sectors already covered in the watchlist
  const coveredSectors = new Set(
    watchlistSectors.map((r) => r.sector).filter(Boolean) as string[]
  );

  return rows.map((r) => ({
    ticker: r.ticker,
    name: r.name,
    exchange: r.exchange,
    quoteType: r.type === "ETP" ? "ETF" : "EQUITY",
    sector: r.sector ?? undefined,
    industry: r.industry ?? undefined,
    // Diversifies = has a sector AND that sector isn't already covered
    diversifies:
      userId && r.sector ? !coveredSectors.has(r.sector) : undefined,
  }));
}
