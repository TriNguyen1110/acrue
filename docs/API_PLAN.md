# ACRUE API Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js Frontend                        │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST / WebSocket
┌───────────────────────────▼─────────────────────────────────┐
│              Node.js API (Next.js API Routes)                │
│   Auth │ Watchlist │ Alerts │ News │ Signals │ Portfolio     │
│                                                              │
│  Compute layer (same process / worker threads):              │
│   simple-statistics │ ml-matrix │ yahoo-finance2             │
└──────┬──────────────────────────────────────────────────────┘
       │ PostgreSQL
┌──────▼──────┐     ┌──────────────┐
│  PostgreSQL  │     │    Redis      │
│  (primary   │     │  (quote cache)│
│   store)    │     └──────────────┘
└─────────────┘

               ┌──────────────────────────────────────────┐
               ▼                    ▼                     ▼
        Finnhub REST API     rateLimiter.ts            NewsAPI
        (lib/finnhub/)       + tickerScheduler.ts
```

**Key design decision**: All computation (signals, portfolio math, NLP sentiment) runs inside Node.js using `simple-statistics`, `ml-matrix`, and lightweight NLP libraries. No separate microservice.

---

## Database Schema (PostgreSQL)

```sql
users              (id, email, password_hash, created_at, preferences jsonb)
watchlist          (id, user_id, ticker, added_at)
assets             (ticker, name, sector, exchange, metadata jsonb)
alerts             (id, user_id, ticker, type, message, severity, triggered_at, read)
alert_rules        (id, user_id, ticker, rule_type, threshold, cooldown_minutes)
news_articles      (id, ticker[], headline, summary, sentiment, source, published_at)
signal_scores      (id, ticker, user_id, score, confidence, breakdown jsonb, scored_at)
portfolio_holdings (id, user_id, ticker, shares, avg_cost)
portfolio_snapshots(id, user_id, holdings jsonb, metrics jsonb, created_at)
simulations        (id, user_id, scenario jsonb, results jsonb, created_at)
```

---

## API Endpoints

### Auth — `/api/auth`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Login, return JWT |
| `POST` | `/api/auth/logout` | Invalidate session |
| `GET` | `/api/auth/me` | Get current user profile |
| `PATCH` | `/api/auth/me` | Update preferences/settings |
| `PATCH` | `/api/auth/me/password` | Change password |

---

### Use Case 1 — Watchlist — `/api/watchlist`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/watchlist` | Get user's watchlist with latest quotes |
| `POST` | `/api/watchlist` | Add ticker to watchlist |
| `DELETE` | `/api/watchlist/:ticker` | Remove ticker from watchlist |
| `GET` | `/api/assets/search?q=` | Search assets by ticker or name |
| `GET` | `/api/assets/:ticker` | Get asset metadata + live quote |

**Request — Add to Watchlist:**
```json
POST /api/watchlist
{ "ticker": "AAPL" }
```

**Response — Get Watchlist:**
```json
[
  {
    "ticker": "AAPL",
    "name": "Apple Inc.",
    "price": 214.32,
    "change_pct": 1.4,
    "volume": 58200000,
    "added_at": "2026-03-01T10:00:00Z"
  }
]
```

**Error cases:**
- `409 Conflict` — ticker already in watchlist
- `404 Not Found` — ticker does not exist in asset DB

---

### Use Case 2 — Alerts — `/api/alerts`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/alerts` | Get alert history (paginated) |
| `GET` | `/api/alerts/unread` | Get unread alerts count + list |
| `PATCH` | `/api/alerts/:id/read` | Mark alert as read |
| `DELETE` | `/api/alerts/:id` | Dismiss alert |
| `GET` | `/api/alerts/rules` | Get user's alert sensitivity rules |
| `POST` | `/api/alerts/rules` | Create custom alert rule |
| `PATCH` | `/api/alerts/rules/:id` | Update rule threshold |
| `DELETE` | `/api/alerts/rules/:id` | Delete rule |

**Alert Rule body:**
```json
POST /api/alerts/rules
{
  "ticker": "TSLA",
  "rule_type": "price_change",   // price_change | volume_spike | volatility
  "threshold": 5.0,              // e.g. 5% price move
  "cooldown_minutes": 60
}
```

**Alert object:**
```json
{
  "id": "uuid",
  "ticker": "TSLA",
  "type": "price_change",
  "message": "TSLA moved +7.2% in the last 30 minutes",
  "severity": "high",            // low | medium | high
  "triggered_at": "2026-03-10T14:32:00Z",
  "read": false
}
```

**Background job** (Node cron):
- `runAlertDetection()` — runs every 5 min, computes anomaly scores in Node (z-score via `simple-statistics`), writes alerts to DB, pushes via WebSocket

---

### Use Case 3 — News — `/api/news`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/news` | News for all watchlist assets |
| `GET` | `/api/news/:ticker` | News filtered by ticker |
| `GET` | `/api/news?sector=Tech` | News filtered by sector |
| `GET` | `/api/news?topic=fed` | News filtered by macro topic |
| `GET` | `/api/news/article/:id` | Full article context + expanded insight |

**Response — News Item:**
```json
{
  "id": "uuid",
  "headline": "Apple beats Q1 earnings expectations",
  "summary": "Apple reported revenue of $124B...",
  "sentiment": "positive",        // positive | neutral | negative
  "sentiment_score": 0.82,        // 0-1
  "impact": "high",
  "related_tickers": ["AAPL"],
  "source": "Reuters",
  "published_at": "2026-03-10T09:00:00Z",
  "insight": "Strong earnings may support upward price momentum short-term."
}
```

**Background job:**
- Polls NewsAPI every 15 minutes
- Runs sentiment analysis in Node via `sentiment` (AFINN-based) or `natural`
- Entity/ticker extraction via keyword matching against asset DB
- Stores enriched articles in `news_articles` table

---

### Use Case 4 — Signals — `/api/signals`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/signals` | Signal scores for all watchlist assets |
| `GET` | `/api/signals/:ticker` | Detailed signal breakdown for one asset |
| `GET` | `/api/signals?sort=bullish` | Sort by signal direction |
| `PATCH` | `/api/signals/weights` | Update user's signal weight preferences |
| `GET` | `/api/signals/weights` | Get current weight configuration |

**Response — Signal Score:**
```json
{
  "ticker": "NVDA",
  "score": 74,                    // 0-100 (>50 bullish, <50 bearish)
  "direction": "bullish",
  "confidence": "high",           // low | medium | high
  "breakdown": {
    "price_momentum": { "value": 82, "weight": 0.3 },
    "volume_anomaly": { "value": 68, "weight": 0.25 },
    "volatility":     { "value": 55, "weight": 0.2 },
    "news_sentiment": { "value": 79, "weight": 0.25 }
  },
  "scored_at": "2026-03-10T14:00:00Z"
}
```

**Compute logic (Node, internal `lib/signals.js`):**
- Price momentum: rate-of-change + EMA crossover via `technicalindicators`
- Volume anomaly: z-score on rolling volume via `simple-statistics`
- Volatility: rolling standard deviation of log returns
- News sentiment: aggregated from `news_articles` table (last 24h)

---

### Use Case 5 — Portfolio — `/api/portfolio`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/portfolio` | Get holdings + current metrics |
| `POST` | `/api/portfolio/holdings` | Add holding |
| `PATCH` | `/api/portfolio/holdings/:ticker` | Update shares/avg cost |
| `DELETE` | `/api/portfolio/holdings/:ticker` | Remove holding |
| `GET` | `/api/portfolio/optimize` | Get optimization suggestion |
| `POST` | `/api/portfolio/simulate` | Run scenario simulation |
| `GET` | `/api/portfolio/simulations` | Get past simulation results |

**Holdings response:**
```json
{
  "holdings": [
    { "ticker": "AAPL", "shares": 50, "avg_cost": 195.00, "current_price": 214.32, "pnl_pct": 9.9 }
  ],
  "metrics": {
    "expected_return": 0.142,
    "volatility": 0.187,
    "sharpe_ratio": 1.34,
    "diversification_score": 72
  }
}
```

**Optimize request:**
```
GET /api/portfolio/optimize?risk=moderate
// risk: conservative | moderate | aggressive
```

**Optimize response:**
```json
{
  "suggested_weights": {
    "AAPL": 0.30,
    "NVDA": 0.25,
    "MSFT": 0.25,
    "SPY":  0.20
  },
  "projected_return": 0.168,
  "projected_volatility": 0.172,
  "method": "mean_variance"
}
```

**Simulate request:**
```json
POST /api/portfolio/simulate
{
  "scenario": {
    "type": "market_downturn",   // market_downturn | sector_shock | volatility_spike
    "magnitude": -0.20,          // -20% market drop
    "duration_days": 90
  },
  "runs": 1000
}
```

**Simulate response:**
```json
{
  "simulation_id": "uuid",
  "expected_outcome": -0.12,
  "upside_p90": 0.05,
  "downside_p10": -0.28,
  "probability_bands": [
    { "range": [-0.30, -0.20], "probability": 0.15 },
    { "range": [-0.20, -0.10], "probability": 0.40 },
    { "range": [-0.10,  0.00], "probability": 0.30 },
    { "range": [0.00,   0.10], "probability": 0.15 }
  ]
}
```

**Compute logic (Node, internal `lib/portfolio.js`):**
- Metrics: covariance matrix + Sharpe via `ml-matrix` + `simple-statistics`
- Optimization: mean-variance efficient frontier (gradient descent on weights)
- Simulation: Monte Carlo with correlated returns via Cholesky decomposition (`ml-matrix`)

---

## Real-time — WebSocket

```
WS /ws/alerts      — push new alerts to connected clients instantly
WS /ws/quotes      — live price ticks for watchlist assets
```

---

## Background Jobs (Node scheduler — `node-cron`)

| Job | Frequency | Action |
|-----|-----------|--------|
| Market data ingest | Every 1 min (market hours) | Score tickers via `tickerScheduler` (importance + staleness + volatility + volume spike), pull quotes via Finnhub through `rateLimiter`, update Redis cache |
| Alert detection | Every 5 min | Compute anomaly scores in Node, write & push alerts |
| News ingest | Every 15 min | Fetch NewsAPI, run Node NLP enrichment, store |
| Signal scoring | Every 30 min | Recompute scores for all watchlist assets |
| Portfolio snapshot | Daily | Save portfolio metrics snapshot for history |

---

## Node.js Libraries

| Purpose | Library |
|---------|---------|
| Market data | Finnhub REST API (`lib/finnhub/`) |
| Rate limiting | `lib/rateLimiter.ts` — token bucket, 55 req/min, 3-tier priority queue |
| Ticker scheduling | `lib/tickerScheduler.ts` — scores tickers by importance + staleness + volatility + volume spike |
| Technical indicators | `technicalindicators` |
| Statistics / z-score | `simple-statistics` |
| Matrix math (portfolio) | `ml-matrix` |
| Sentiment analysis | `sentiment` (AFINN) or `natural` |
| Scheduling | `node-cron` |
| WebSocket | `ws` or Next.js with `socket.io` |
| Caching | `ioredis` |

---

## Cross-cutting Concerns

| Concern | Approach |
|---------|----------|
| Auth | JWT (access token 15min + refresh token 7d) |
| Rate limiting | 100 req/min per user on Node routes |
| Market data caching | Redis via `ioredis`; TTL 60s for quotes |
| Error format | `{ "error": "code", "message": "..." }` + standard HTTP codes |
| Pagination | `?page=1&limit=20` on list endpoints |
| API versioning | `/api/v1/...` prefix from the start |

---

## Development Priority Order

1. **Auth + Watchlist** — foundation everything else depends on
2. **Market data ingest + Quotes** — needed for all other features
3. **Signals** — high-value, depends on market data
4. **Alerts** — depends on signals/market data
5. **News** — parallel track, NLP-heavy
6. **Portfolio** — most complex, save for last
