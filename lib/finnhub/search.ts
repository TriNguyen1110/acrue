import { redis } from "@/lib/cache";
import { finnhubGet, PRIORITY } from "./client";
import type { AssetSearchResult } from "@/types";

const SEARCH_TTL = 3600; // 1h — search results change slowly

interface FinnhubSearchResult {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
}

interface FinnhubSearchResponse {
  count: number;
  result: FinnhubSearchResult[];
}

/**
 * Searches tickers and company names via Finnhub's /search endpoint.
 *
 * Tradeoff: Finnhub search does not return sector/industry — those are only
 * available via /stock/profile2. We omit them here to avoid N profile calls
 * per search query (too expensive for a typeahead). Sector/industry are
 * populated later when the user adds a ticker and we fetch its full profile.
 */
export async function searchAssets(query: string): Promise<AssetSearchResult[]> {
  if (!query || query.trim().length < 1) return [];

  const q = query.trim();
  const cacheKey = `search:${q.toLowerCase()}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as AssetSearchResult[];

  const data = await finnhubGet<FinnhubSearchResponse>(
    "/search",
    { q },
    PRIORITY.USER // user-initiated typeahead — needs to feel instant
  );

  const assets: AssetSearchResult[] = (data.result ?? [])
    .filter((r) => r.symbol && r.type === "Common Stock")
    .slice(0, 10)
    .map((r) => ({
      ticker: r.symbol,
      name: r.description,
      exchange: r.displaySymbol.includes(":") ? r.displaySymbol.split(":")[0] : "",
      quoteType: "EQUITY",
    }));

  await redis.setex(cacheKey, SEARCH_TTL, JSON.stringify(assets));
  return assets;
}
