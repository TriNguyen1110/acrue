# services/

Business logic layer. Services own the domain rules, orchestrate calls to `lib/`, and are the only layer that API routes should import from.

**Rule:** API routes import from `services/` only. Services import from `lib/` only. Never import a service from another service unless it's a clear dependency (e.g. `signals.ts` reading from `news.ts` for sentiment data).

## Files

| File | Responsibility |
|------|---------------|
| `tickerScheduler.ts` | Continuous 1s tick that scores watchlist tickers and feeds the rate limiter MEDIUM queue |
| `auth.ts` | JWT auth, password hashing, session management *(Day 1)* |
| `marketData.ts` | Quote batching, derived series (returns, closes, volumes), market status, overview *(Day 2)* |
| `search.ts` | Tag-based recommender + autocomplete. Finnhub `/search` provides candidates, re-ranked by sector/industry/quoteType tag overlap and DB popularity. Capped at 10 results. *(Day 2)* |
| `notifications.ts` | `node-cron` scheduler — wires all background jobs *(Day 3)* |
| `news.ts` | NewsAPI ingestion, NLP sentiment pipeline, ticker extraction *(Day 4)* |
| `signals.ts` | Cumulative signal scoring (momentum, volume, volatility, sentiment) *(Day 5)* |
| `portfolio.ts` | Holdings metrics, mean-variance optimisation, Monte Carlo simulation *(Day 6–7)* |
| `ws.ts` | WebSocket server — pushes quotes and alerts to connected clients *(Day 8)* |

## Data flow

```
API Route
  └─ services/marketData.ts
       ├─ lib/finnhub/quote.ts    → Finnhub /quote (via rateLimiter)
       ├─ lib/finnhub/chart.ts    → Finnhub /stock/candle (via rateLimiter)
       └─ lib/cache.ts            → Redis (stale fallback, derived caches)
```

## Caching conventions (service-level)

These keys are owned by `services/` and sit on top of the lib-level caches:

| Key pattern | TTL | Contents |
|-------------|-----|----------|
| `returns:{TICKER}:{days}` | 1h | `number[]` of daily log returns |
| `overview:{n}` | 5 min | `MarketOverview` (gainers + losers + actives) |
| `signal:{TICKER}` | 30 min | `SignalScore` object |
| `news:{TICKER}` | 15 min | `NewsArticle[]` enriched with sentiment |
