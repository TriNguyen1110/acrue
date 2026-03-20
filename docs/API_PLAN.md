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
        Finnhub REST API     rateLimiter.ts          RSS Feeds
        (lib/finnhub/)       + tickerScheduler.ts   (rss-parser)
                                                  Reuters, CNBC,
                                                  MarketWatch, etc.
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
| `GET` | `/api/alerts/filters` | Get all distinct filter values across full alert + watchlist history |
| `PATCH` | `/api/alerts/:id/read` | Mark alert as read |
| `PATCH` | `/api/alerts/read-all` | Mark all alerts as read |
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

**`GET /api/alerts/filters` response:**
```json
{
  "tickers": ["AAPL", "NVDA"],
  "sectors": ["Technology", "Healthcare"],
  "industries": ["Software", "Semiconductors", "Biotechnology"],
  "capTiers": [">$200B", ">$10B"],
  "hasEtf": false
}
```
Note: `industries` powers the "Topic" filter chips in the UI — filtered by `alert.industry` on the client. `tickers` contains only alert-firing tickers; `industries` comes from the combined alert + watchlist ticker set for full coverage.

**Background job** (Node cron):
- `runAlertDetection()` — driven by `tickerScheduler.afterFetchListener` (runs up to 55×/min on freshly cached quotes); nightly retention cron purges read alerts >30d, unread >90d, caps at 500 rows/user

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
- Two ingest sources run on separate schedules:
  - **Finnhub `/company-news`** — ticker-specific news, polled every 15 min per watchlist ticker, already rate-limited via `rateLimiter.ts`
  - **RSS feeds** — macro/general financial news (Reuters, CNBC, MarketWatch, Yahoo Finance, Seeking Alpha), polled 4× daily at market-aligned times (07:00, 09:30, 12:00, 16:30 ET)
- `rss-parser` parses XML → clean JS objects (title, contentSnippet, link, pubDate)
- Sentiment analysis via `sentiment` (AFINN lexicon) on headline + summary:
  - AFINN is a ~3,500-word English lexicon where each word is pre-scored −5 to +5 by researchers (e.g. "profit" → +3, "bankrupt" → −5)
  - Raw score = sum of all matched word scores in the article text
  - Normalised by word count to remove length bias: `raw / (wordCount × 5)` → `[−1, +1]`
  - Remapped to `[0, 1]`: `(clamped + 1) / 2`  (0 = very negative, 0.5 = neutral, 1 = very positive)
  - Label thresholds: `< 0.4` → negative, `0.4–0.6` → neutral, `> 0.6` → positive
  - Impact derived from distance from neutral: `> 0.75 or < 0.25` → high, `> 0.60 or < 0.40` → medium, else low
- Ticker extraction via keyword matching against asset DB (company names + tickers)
- Macro articles with no direct ticker match tagged by topic (fed, inflation, earnings, etc.) and linked to related sectors
- Stores enriched articles in `news_articles` table, deduplicated by URL

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

**Compute logic (Node, `services/signals.ts`):**
- **Price momentum (35%)**: day's % change mapped to [0,100] + 52-week range position (near 52w high = strong momentum)
- **Analyst consensus (25%)**: Buy/Hold/Sell rating + % upside to mean analyst price target
- **Valuation (20%)**: P/E ratio bracketed score + PEG ratio (P/E ÷ analyst-target-implied growth rate)
- **News sentiment (20%)**: weighted average of `sentimentScore` from articles tagged with the ticker (last 7 days), impact-weighted (high=2×, medium=1×, low=0.5×), mapped [0,1] → [0,100]
- **Statistical projection (30-day)**: annual vol estimated from 52-week range (`(52wH−52wL) / (2×1.96×price)`), monthly vol = annualVol/√12, 90% CI = expected ± 1.645σ, P(positive) via normal CDF
- **Sharpe estimate**: (annualised expected return − 5% risk-free rate) / annualVol
- Note: volume z-score, RSI, EMA cross require `/stock/candle` which returns 403 on Finnhub free tier — excluded

---

### Use Case 5 — Portfolio — `/api/portfolio`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/portfolio` | Get holdings + current metrics (60s Redis cache) |
| `POST` | `/api/portfolio/holdings` | Add holding |
| `PATCH` | `/api/portfolio/holdings/:ticker` | Update shares/avg cost |
| `DELETE` | `/api/portfolio/holdings/:ticker` | Remove holding |
| `GET` | `/api/portfolio/optimize` | Get MPT optimization suggestion |

**Holdings response:**
```json
{
  "holdings": [
    { "ticker": "AAPL", "shares": 50, "avgCost": 195.00, "currentPrice": 214.32, "pnlPct": 9.9 }
  ],
  "metrics": {
    "expectedReturn": 0.142,
    "volatility": 0.187,
    "sharpeRatio": 1.34,
    "diversificationScore": 72
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
  "suggestedWeights": { "AAPL": 0.30, "NVDA": 0.25, "MSFT": 0.25, "SPY": 0.20 },
  "projectedReturn": 0.168,
  "projectedVolatility": 0.172,
  "method": "projected_gradient_ascent"
}
```

**Compute logic (`services/portfolio.ts`):**
- Metrics: covariance matrix (`lib/historicalPrices.ts`, Yahoo Finance 24h cache), Sharpe, HHI diversification
- Optimization: projected gradient ascent on `U = μ − A×σ²`, simplex projection (Duchi 2008), 500 iterations

---

### Use Case 6 — Paper Trading (Simulate) — `/api/simulate`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/simulate` | List all simulated portfolios for user |
| `POST` | `/api/simulate` | Create a new simulated portfolio |
| `GET` | `/api/simulate/:id` | Get portfolio with live-enriched holdings + metrics |
| `DELETE` | `/api/simulate/:id` | Delete portfolio |
| `POST` | `/api/simulate/:id/holdings` | Add holding (locks in current market price as startPrice) |
| `DELETE` | `/api/simulate/:id/holdings/:ticker` | Remove holding |

**Create portfolio request:**
```json
POST /api/simulate
{ "name": "Tech Growth Play", "description": "Bet on AI tailwind Q2" }
```

**Portfolio response (with enriched holdings):**
```json
{
  "id": "uuid",
  "name": "Tech Growth Play",
  "holdings": [
    {
      "ticker": "NVDA",
      "shares": 10,
      "startPrice": 875.50,
      "currentPrice": 912.30,
      "returnPct": 4.2
    }
  ],
  "metrics": {
    "totalStartValue": 8755.00,
    "totalCurrentValue": 9123.00,
    "totalReturnPct": 4.2,
    "topGainer": { "ticker": "NVDA", "returnPct": 4.2 },
    "topLoser": null
  }
}
```

**Error cases:**
- `404` — portfolio not found or belongs to different user
- `409` — ticker already in this portfolio
- `404` — ticker not found in asset DB

**Compute logic (`services/simulate.ts`):**
- `startPrice` locked at add time from live Finnhub quote
- `currentPrice` fetched via `Promise.allSettled` on GET (falls back to `startPrice` if quote fails)
- Multiple portfolios per user, each independently tracked — enables side-by-side strategy comparison
- Comparison leaderboard shown in UI when ≥2 portfolios have holdings

---

## Real-time — WebSocket

Single endpoint: `WS /ws`

**Server → client messages:**
```json
{ "type": "quote",  "ticker": "AAPL", "price": 214.32, "changePct": 1.4, "volume": 58200000 }
{ "type": "alert",  "id": "uuid", "ticker": "AAPL", "alertType": "price_change", "message": "...", "severity": "high", "triggeredAt": "..." }
{ "type": "subscribed", "tickers": ["AAPL", "NVDA"] }
{ "type": "error",  "message": "Unauthorized" }
{ "type": "pong" }
```

**Client → server messages:**
```json
{ "type": "ping" }
{ "type": "subscribe",   "ticker": "TSLA" }
{ "type": "unsubscribe", "ticker": "TSLA" }
```

**Authentication:** session cookie (`next-auth.session-token`) read from the WS upgrade request, decoded directly via `@auth/core/jwt` — no extra round-trip.

**Quote broadcasts:** driven by `tickerScheduler.afterFetchListener` — up to 55×/min per ticker.

**Alert broadcasts:** fired from `notifications.ts` after each alert detection cycle; high-severity alerts also trigger a browser push notification.

---

## Push Notifications — `/api/v1/notifications/push`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/notifications/push/subscribe` | Save push subscription (endpoint, p256dh, auth) |
| `DELETE` | `/api/v1/notifications/push/subscribe` | Remove subscription by endpoint |
| `POST` | `/api/v1/notifications/push/test` | Send a test push to the current user |

**Subscribe request:**
```json
POST /api/v1/notifications/push/subscribe
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": { "p256dh": "...", "auth": "..." }
}
```

**Test response:**
```json
{ "sent": true, "attempted": 1, "succeeded": 1, "errors": [] }
```

High-severity alerts only. Service worker at `/sw.js` handles `push` events and shows OS-level browser notifications via `showNotification()`.

---

## Background Jobs (Node scheduler — `node-cron`)

| Job | Frequency | Action |
|-----|-----------|--------|
| Market data ingest | Every 1 min (market hours) | Score tickers via `tickerScheduler` (importance + staleness + volatility + volume spike), pull quotes via Finnhub through `rateLimiter`, update Redis cache |
| Alert detection | Per quote refresh (≤55/min) | Per-ticker anomaly detection triggered by tickerScheduler afterFetchListener |
| News ingest — ticker | Every 15 min | Fetch Finnhub `/company-news` per watchlist ticker, run NLP enrichment, store |
| News ingest — macro | 4× daily (07:00, 09:30, 12:00, 16:30 ET) | Fetch RSS feeds (Reuters, CNBC, MarketWatch, etc.), extract tickers/topics, run NLP, store |
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
| Sentiment analysis | `sentiment` (AFINN) |
| RSS feed parsing | `rss-parser` — parses XML from Reuters, CNBC, MarketWatch, Yahoo Finance, Seeking Alpha |
| Scheduling | `node-cron` |
| WebSocket | `ws` (`noServer: true` + custom `server.ts`, only handles `/ws` path) |
| Push notifications | `web-push` (VAPID) + service worker (`public/sw.js`) |
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
