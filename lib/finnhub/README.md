# lib/finnhub/

Finnhub REST API data access layer. Handles all outbound calls to `https://finnhub.io/api/v1`, caching responses in Redis, and mapping raw API shapes to internal types.

**Rule:** All Finnhub calls must go through `client.ts` → `rateLimiter`. Never call `fetch` directly against Finnhub.

## Files

| File | Finnhub endpoints | Cache TTL |
|------|------------------|-----------|
| `client.ts` | — base `finnhubGet<T>()` | — |
| `quote.ts` | `/quote`, `/stock/profile2`, `/stock/metric` | 60s / 24h / 6h |
| `chart.ts` | `/stock/candle` | 60s–86400s by interval |
| `search.ts` | `/search` | 1h |
| `summary.ts` | `/stock/profile2`, `/stock/recommendation`, `/stock/price-target` | 6h |
| `screener.ts` | — computed from cached S&P 100 quotes | 5 min |
| `index.ts` | barrel re-export | — |

## Request priority

Every `finnhubGet` call takes a priority that feeds into the rate limiter queue:

| Priority | Used for |
|----------|---------|
| `"high"` | User-initiated: search typeahead, asset detail page, watchlist first load |
| `"medium"` | Per-minute quote refresh driven by `tickerScheduler` |
| `"low"` | Background: profile/metrics cache miss, candle fetches, screener universe refresh |

## Known data gaps (Finnhub free tier)

| Field | Status |
|-------|--------|
| `volume` in `/quote` | Not returned — set to `0`; populated via candle data |
| `description` (company bio) | Not on free tier — always `null` |
| `employees` | Not in `/stock/profile2` — always `null` |
| `sector` / `industry` in search | Not in `/search` response — omitted from `AssetSearchResult` |
| `quoteType` (EQUITY/ETF) | Not live — hardcoded to `"EQUITY"` |

See `docs/DECISIONS.md` for the full tradeoff discussion.
