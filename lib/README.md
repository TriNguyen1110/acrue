# lib/

Infrastructure layer. Contains only low-level plumbing — no business rules live here.

**Rule:** Nothing in `lib/` should import from `services/`. Data flows one way: `services/` → `lib/` → external systems.

## Files

| File | Purpose |
|------|---------|
| `db.ts` | Prisma client singleton. Import `prisma` from here for all DB access. |
| `cache.ts` | Redis client singleton via `ioredis`. Import `redis` from here. |
| `rateLimiter.ts` | Token bucket rate limiter (55 req/min, 3-tier priority queue). All outbound Finnhub calls must go through this. |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `finnhub/` | Finnhub REST API data access layer. Each file maps to one domain of the API. |

## Caching conventions

All Redis keys used in this layer:

| Key pattern | TTL | Contents |
|-------------|-----|----------|
| `quote:{TICKER}` | 60s | Serialised `Quote` object |
| `finnhub:profile:{TICKER}` | 24h | Finnhub `/stock/profile2` response |
| `finnhub:metrics:{TICKER}` | 6h | Finnhub `/stock/metric` response |
| `chart:{TICKER}:{interval}:{from}:{to}` | varies by interval | `Candle[]` array |
| `search:{query}` | 1h | `AssetSearchResult[]` |
| `summary:{TICKER}` | 6h | `AssetSummary` object |
| `screener:gainers:{n}` | 5 min | `ScreenerResult[]` sorted by changePct desc |
| `screener:losers:{n}` | 5 min | `ScreenerResult[]` sorted by changePct asc |
| `screener:actives:{n}` | 5 min | `ScreenerResult[]` sorted by volume desc |
| `ticker:last_fetched` | no TTL (hash) | Map of ticker → unix timestamp of last quote fetch |
