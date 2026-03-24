# Acrue — Architecture & Engineering Decisions

A narrative document covering every significant design decision, constraint, and tradeoff made during development. Written for engineers and hiring managers who want to understand the thinking behind the system, not just what it does.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Stack Choices](#2-stack-choices)
3. [Priority Queue & Rate Limiting](#3-priority-queue--rate-limiting)
4. [Ticker Scheduler — Distributed Work Queue](#4-ticker-scheduler--distributed-work-queue)
5. [Search Autocomplete & Recommender](#5-search-autocomplete--recommender)
6. [Alert Detection](#6-alert-detection)
7. [News Pipeline](#7-news-pipeline)
8. [Signal Scoring](#8-signal-scoring)
9. [Portfolio Optimization](#9-portfolio-optimization)
10. [Paper Trading](#10-paper-trading)
11. [WebSocket Server](#11-websocket-server)
12. [Push Notifications](#12-push-notifications)
13. [Frontend Architecture](#13-frontend-architecture)
14. [Database Design](#14-database-design)
15. [Deployment](#15-deployment)

---

## 1. System Overview

Acrue is a full-stack stock market intelligence platform built as a single Next.js application. The system ingests live market data from Finnhub (up to 55 requests/min), runs NLP and statistical scoring pipelines in-process, and delivers results to the user via REST API, WebSocket, and browser push notifications.

The architecture follows a strict layering rule:

```
Frontend → API Routes → Services → Infrastructure (lib/)
                                         │
                              External APIs (Finnhub, RSS feeds)
```

- **`lib/`** — pure infrastructure: DB client (Prisma), Redis client, rate limiter, Finnhub data access layer
- **`services/`** — all business logic: auth, watchlist, alerts, news NLP, signals scoring, portfolio math, paper trading, WebSocket broadcast
- **`app/api/`** — thin controllers: validate input, call one service method, return JSON
- **`components/`** — split between stateless UI primitives (`ui/`) and data-fetching components (`stateful/`)

No business logic lives in API routes. No DB queries live in components. This makes each layer independently testable and keeps responsibility clear.

---

## 2. Stack Choices

### Why Next.js (not separate frontend + backend)
A single Next.js app eliminates the coordination overhead of two repos, two deploy pipelines, and two CI configs. API routes live alongside the pages that consume them. For a portfolio project with one developer, the monolith is the right call.

### Why TypeScript throughout
Type safety at the boundary between services and API routes catches an entire class of bugs before they reach production. Prisma generates TypeScript types directly from the schema, so the DB model and API response types stay in sync automatically.

### Why Prisma (not raw `pg`)
Auto-generated types from the schema mean adding a column to the DB immediately surfaces everywhere it's consumed. Prisma's query builder handles joins, aggregates, and pagination cleanly. Any query it can't express falls back to `$queryRaw`. The build step (`prisma generate`) is a minor cost for a TypeScript project already running a build step.

### Why Finnhub (not yahoo-finance2, Polygon, Alpha Vantage)

| Option | Why rejected |
|--------|-------------|
| `yahoo-finance2` | Scrapes Yahoo's undocumented internal endpoints — breaks silently when Yahoo changes their structure. Not defensible for production. |
| Polygon.io free | 5 req/min hard cap and 15-minute delayed data — incompatible with 1-minute refresh intervals. |
| Alpha Vantage free | 25 req/day — unusable for any real workload. |
| **Finnhub free** | 60 req/min real-time data, WebSocket feed included, stable REST API. Viable with a rate limiter. |

The key tradeoff accepted with Finnhub: no batch quote endpoint. Every ticker requires an individual `/quote` call. This is mitigated by Redis caching (60s TTL per ticker) and the priority scheduler (described below).

### Why Redis
Redis serves two purposes: quote cache (60s TTL per ticker, avoiding redundant Finnhub calls for the same ticker) and rate limiter state (token count for the token bucket). An in-memory Map would work for a single process but Redis makes the cache observable and allows future multi-instance deploys without a rewrite.

### Why all compute in Node.js (no Python microservice)
Node.js libraries (`technicalindicators`, `simple-statistics`, `ml-matrix`, `sentiment`) are sufficient for the math this system needs: AFINN NLP, OHLCV indicators, covariance matrices, and gradient descent optimization. Adding a Python sidecar would introduce network hops, a separate process to manage, and a second language to maintain — unnecessary at this scale.

---

## 3. Priority Queue & Rate Limiting

### The Core Constraint

Finnhub's free tier allows **60 requests/min** across all callers — user page loads, background quote refreshes, screener pre-warming, profile fetches. Every request flows through a single shared API key. Without explicit coordination, concurrent users burst past this instantly and receive 429 errors. A naive retry-with-backoff strategy makes contention worse.

### Token Bucket

The rate limiter (`lib/rateLimiter.ts`) implements a token bucket:

```
capacity  = 55 tokens   (not 60 — 5 token headroom absorbs clock skew)
refill    = 0.917 tokens/sec  (~55/min continuous)
drain     = one token consumed per Finnhub call
```

The 55/60 headroom is deliberate. Finnhub's server-side rate limit window resets on their clock, not ours. A burst right before their window resets counts against both the current and next window. The 5 token buffer ensures we never touch the hard cap even under minor timing drift.

### Scored Priority Queue

All pending Finnhub requests sit in a single sorted queue keyed by a float score `0.0–1.0`. On each drain tick, the highest-scored request is popped first.

```
PRIORITY.USER        = 1.0  — user-initiated (search, page load)
PRIORITY.BACKGROUND  = 0.0  — screener pre-warming, profile fetching
scheduler score      = 0.0–1.0  — background ticker refreshes, ranked by urgency
```

This means a user typing in the search box always gets their Finnhub call processed before any background work, regardless of queue depth. Background jobs fill in the remaining budget.

**Why a continuous float, not 3 tiers (HIGH/MEDIUM/LOW)?**

An earlier version bucketed scheduler-enqueued requests into "MEDIUM" regardless of their computed urgency score. Two tickers with scores 0.85 and 0.12 sat in the same tier and drained FIFO — defeating the scoring formula entirely. With a numeric queue, the highest-scored ticker pre-empts lower-scored ones within the same drain cycle.

**Tradeoffs:**
- In-memory only — a server restart loses the queue state. A Redis-backed queue with sorted sets (`ZADD` / `ZPOPMAX`) would be the production-scale equivalent, enabling queue persistence and multi-instance operation. In-memory is acceptable for a single Next.js process.
- No per-user fairness — a user with 50 watchlist tickers gets more background slots than a user with 5. A production system would add per-user token accounting. Acceptable here.

### Finnhub Data Access Layer (`lib/finnhub/`)

The Finnhub layer follows the repository pattern: each file (`quote.ts`, `summary.ts`, `search.ts`, `screener.ts`) is a thin fetch wrapper that routes through the rate limiter and applies Redis caching. Services never call Finnhub directly — they call the data access layer, which handles caching and rate limiting transparently.

Cache TTLs match data staleness characteristics:

| Data | TTL | Reason |
|------|-----|--------|
| Quote price | 60s | Changes every market tick |
| Company profile | 6h | Sector/industry/analyst ratings change rarely |
| Search results | 1h | Ticker universe changes rarely |
| Screener | 10min | Day gainers/losers need periodic refresh |

Without caching, every API route that touches a quote would consume a rate-limit token. With 60s TTL, the same ticker is fetched at most once per minute regardless of how many users are viewing it.

### Screener Without a Screener API

Finnhub free doesn't provide screener endpoints (day gainers, losers, most-actives). The screener is computed by maintaining a hardcoded S&P 100 universe (~100 tickers) and sorting cached quotes by `changePct`. The S&P 100 fetch runs at `PRIORITY.BACKGROUND` — it fills idle capacity and never competes with user requests. Screener data cached at 10-min TTL.

Tradeoff: only S&P 100 names surface in discovery. Acceptable; covers the most actively traded US equities and the tickers users are most likely to search for.

---

## 4. Ticker Scheduler — Distributed Work Queue

### Problem

All watchlisted tickers across all users need fresh quotes continuously. At any given time, there might be 200 tickers to refresh but only 55 Finnhub calls available per minute. Naively fetching all tickers in a round-robin would take several minutes to complete a full cycle — meaning a volatile ticker that spiked 10 minutes ago might not be refreshed for another 2 minutes.

The system needs to answer: **given a budget of 55 calls/min, which tickers should we fetch right now?**

### Two-Timer Architecture

The scheduler (`services/tickerScheduler.ts`) separates two concerns into two timers:

**60-second rebuild timer (queue management):**
1. Queries DB: load all watchlisted tickers with watcher counts
2. Re-scores each ticker using the urgency formula
3. Produces a freshly sorted priority queue (array sorted descending by score)

**~1091ms drain timer (`60,000ms ÷ 55 ≈ 1091ms`) (execution):**
1. Pop the highest-scored ticker from the queue
2. Fire one rate-limited Finnhub quote fetch
3. On fetch success: update the in-memory `changePct`, `volume`, `lastFetchedAt` for the next scoring cycle; run alert detection; broadcast over WebSocket
4. On empty queue: no-op — the system uses only what it needs, never wastes budget

### Urgency Scoring Formula

```
importance  = watcherCount / maxWatcherCount        (0–1)  weight 0.35
staleness   = min(ageMs, 60_000) / 60_000           (0–1)  weight 0.25
volatility  = min(|changePct| / 10, 1)              (0–1)  weight 0.25
volumeSpike = min((volume / avgVolume) / 3, 1)      (0–1)  weight 0.15
```

Each signal is normalised to `[0,1]` independently before weighting:
- **Importance** — tickers watched by more users have higher blast radius when stale
- **Staleness** — baseline urgency; a ticker just fetched 5s ago shouldn't re-queue immediately
- **Volatility** — a ticker moving 8% needs fresh data more than a flat one
- **Volume spike** — unusual volume is a leading indicator of price events; supporting signal

All scoring inputs (`changePct`, `volume`, `lastFetchedAt`, `watcherCount`) are kept in-memory on the scheduler instance — the per-tick scoring loop is completely I/O-free.

### Why Not a Simple Cron Round-Robin?

An earlier design sorted all tickers at T=0 and enqueued them all at once. This had a correctness problem: queue order was frozen at T=0. A ticker that was low-priority at T=0 (recently fetched, low volatility) could become the most urgent at T=30s (price spiking, volume surging) with no way to move up. The two-timer model fixes this — the queue is rebuilt from scratch every minute with fresh scores.

### Relation to Distributed Message Queues

This scheduler solves the same class of problem as a distributed message queue (e.g. SQS, Kafka, BullMQ) but simplified for a single-process budget constraint:

| Distributed queue concept | Acrue equivalent |
|---------------------------|-----------------|
| Message priority | Float score `0.0–1.0` per ticker |
| Consumer throughput cap | 55 req/min token bucket |
| Dead letter / retry | `lastFetchedAt = 0` on failure → retries on next drain tick |
| Visibility timeout | `MIN_REFRESH_INTERVAL = 45s` prevents double-queuing in-flight requests |
| Queue rebuild / re-prioritisation | 60s rebuild timer re-scores entire queue |

In a multi-instance production system, the in-memory queue would be replaced with a Redis sorted set (`ZADD` for enqueue by score, `ZPOPMAX` for drain). The token bucket state would move to a Redis atomic counter. The scoring logic stays the same.

**Optimistic locking for in-flight deduplication:** `lastFetchedAt` is set to `Date.now()` *before* the Finnhub call fires (not after). This prevents the next drain tick (1091ms later) from double-queuing the same ticker while the in-flight request is still pending. If the request fails, `lastFetchedAt` is reset to `0` — the ticker retries on the next tick.

**MIN_REFRESH_INTERVAL = 45s:** Prevents a popular ticker (high importance score) from winning every drain slot and starving low-watcher tickers. Set below 60s so every ticker gets at least one refresh per minute regardless of relative importance.

---

## 5. Search Autocomplete & Recommender

### Problem

A plain string search on ticker name returns results in arbitrary order. Searching "tech" should surface Apple, Microsoft, and Nvidia before an obscure ETF with "tech" in its full name. Searching "AAPL" should surface Apple immediately, not sort it alphabetically among other matches. The system needs relevance ranking without a full-text search engine.

### Two-Component Architecture

**Autocomplete (candidate generation):** Finnhub `/search?q=` provides up to 10 matching tickers/companies. This is the candidate pool — fast, always fresh, no local index needed.

**Tag-based recommender (re-ranking):** Candidates are re-scored by relevance using metadata overlap:

```
+3.0  exact ticker match (e.g. query "AAPL" → ticker "AAPL")
+2.0  ticker starts with query prefix
+1.5  sector match (query contains sector keyword)
+1.0  industry match
+1.0  quoteType = EQUITY (preferred over ETF/FUND for general queries)
+0.5  ticker already in local DB (previously added by any user = popularity signal)
```

Results are sorted descending by score and capped at 10.

### Cold vs Warm Results

Sector and industry tags come from the local `assets` DB table — populated when a ticker is first added to any user's watchlist (lazy Finnhub profile fetch). Cold tickers (never added before) have no sector/industry metadata and score on ticker/name match only. Warm tickers (previously seen) get the full re-ranking.

**Why not fetch a full Finnhub profile per search result?**
A profile call costs one rate-limit token. With up to 10 candidates per search query and a user typing in real time (debounced at 300ms), fetching profiles for all candidates on every keystroke would consume ~30 tokens/min from a 55 token budget — 54% of the entire API budget for one user's search session. Completely untenable. The lazy-population model means profiles are only fetched when someone adds a ticker (a low-frequency event), and the metadata persists in the DB for all future searches.

### Tradeoffs

- Cold tickers score on ticker/name only — a ticker that has never been on any user's watchlist won't get sector/industry boost. First search for a new ticker returns a less precise ranking. Acceptable: the ticker is still findable; re-ranking improves on second and subsequent searches after any user adds it.
- The 10-result cap is both a UX choice (don't overwhelm the dropdown) and a budget choice (more candidates = more potential profile fetches in future enhancement).
- Autocomplete is debounced on the frontend (300ms) — no server-side concern needed.

---

## 6. Alert Detection


### Quote-Only Detection (No Candle Data)

Alert detection runs inside `tickerScheduler.afterFetchListener` — triggered on every successful quote fetch, up to 55 times/min. This means detection always runs against freshly cached data with no separate polling loop.

**Why quote-only?**
Finnhub free tier returns 403 on `/stock/candle`. An earlier implementation used candle data for price change and volume spike detection — it compiled successfully but silently returned empty arrays at runtime. All detection was rewritten to use quote fields only:
- `price_change` → `quote.changePct` (day's percentage change vs previous close)
- `volume_spike` → `quote.volume / quote.avgVolume`
- `RSI` → computed from intraday range `(dayHigh − dayLow) / prevClose` as a proxy
- `EMA crossover` → derived from `quote.prevClose` as the short-term EMA anchor

**Rule cooldown:** Each `alertRule` has a per-user per-ticker `lastTriggeredAt` field. A rule won't fire again until the cooldown window (configurable per rule, default 60 min) has elapsed. This prevents alert spam during volatile periods.

**Alert retention:** A nightly cron purges stale alerts in two passes:
1. TTL delete — read alerts older than 30 days, unread older than 90 days
2. Per-user cap — if a user still has >500 rows after TTL, delete oldest (read-first) until at the limit

Without retention, a user with 10 tickers and 3 default rules generates ~720 rows/day — 260,000 rows/year. The dual TTL (30d read, 90d unread) reflects that read alerts have delivered their value, while unread alerts should survive a month-long absence.

---

## 7. News Pipeline

### Source Strategy

Two parallel ingestion paths:

**Finnhub `/company-news`:** Ticker-specific news, fetched every 15 min via the ticker scheduler. Filtered through a `TRUSTED_SOURCES` allowlist of ~16 tier-1 outlets (Reuters, Bloomberg, CNBC, WSJ, etc.). Finnhub aggregates from hundreds of sources including low-quality blogs and press-release syndication services; the allowlist keeps only editorially credible content.

**RSS feeds:** Macro/general financial news from AP Business, CNBC, MarketWatch, Yahoo Finance, and Seeking Alpha. Ingested 4× daily at market-aligned times (07:00, 09:30, 12:00, 16:30 ET). Parsed with `rss-parser`.

**Why RSS over NewsAPI?**
NewsAPI free tier caps at 100 req/day and truncates article text at ~200 chars regardless of plan. RSS feeds from major outlets are free, have no rate limits, and provide full titles and descriptions.

**Why AP Business instead of Reuters?**
Reuters' public RSS endpoint (`feeds.reuters.com`) returned `ENOTFOUND` — the domain no longer resolves. Reuters moved all content behind authenticated feeds. AP Business is a wire service of equivalent quality with a stable free RSS endpoint.

**Startup ingest:** `services/notifications.ts` fires `ingestRssFeeds()` immediately on module load, in addition to the scheduled cron. Without this, if the server starts at 14:00, the next scheduled fetch isn't until 16:30 — meaning the news feed shows no articles for 2.5 hours.

### NLP Pipeline

Each article runs through:

1. **Ticker extraction** — match article text against the DB's ticker/name map using word-boundary regex. Single-letter tickers (`F`, `S`, `M`) are excluded by a minimum-length guard; they can only be tagged via the longer company name match path.

2. **Sentiment scoring (AFINN)** — raw AFINN sum normalised to `[0,1]` before storage:
   ```
   raw = afinnSum / (wordCount × 5)    → [−1, +1] per-word average
   score = (clamped + 1) / 2           → [0, 1]  (0.5 = neutral)
   ```
   Normalising by word count removes length bias — a 500-word article and a 50-word headline expressing the same sentiment produce the same score.

3. **Topic classification** — keyword matching against macro topics (Fed, inflation, earnings, crypto, etc.)

4. **Impact tier** — distance from neutral (0.5):
   - `> 0.75 or < 0.25` → `"high"`
   - `> 0.60 or < 0.40` → `"medium"`
   - otherwise → `"low"`

**Non-fatal ticker extraction:** If the DB lookup for the ticker/name map fails, `extractTickers` returns `[]` rather than throwing. An article stored without ticker tags still carries sentiment and topic data and appears in macro feeds. The cache is cleared on failure so the next call retries the DB query.

---

## 8. Signal Scoring

### Composite Score

A score from 0–100 is computed for each watchlisted ticker from four components:

| Component | Weight | Source |
|-----------|--------|--------|
| Momentum | 35% | `quote.changePct`, price vs 52w high/low |
| Analyst rating | 25% | Finnhub analyst consensus + price target upside |
| Valuation | 20% | P/E ratio, PEG proxy from analyst target upside |
| News sentiment | 20% | Weighted average of 7-day article sentiment scores |

**Why these weights?**
Momentum captures short-term edge most reliably. Analyst ratings add sell-side signal with longer-term perspective. Valuation prevents chasing expensive growth. News sentiment leverages already-stored article data at zero extra API cost.

**PEG proxy:** Finnhub free doesn't provide EPS growth estimates. Analyst price target upside is used as a 1-year forward growth approximation — a rough but reasonable proxy for growth-adjusted valuation.

**52-week range as volatility proxy:** Finnhub free blocks `/stock/candle`, so there's no OHLCV history. The 52w high/low from `/stock/metric` gives `σ ≈ range / (2 × 1.96 × price)` — the range divided by the approximate 2-sigma width of a normal distribution. Sufficient for a 30-day projection confidence interval.

**Confidence interval:** `[score − 1.96σ_30, score + 1.96σ_30]` where `σ_30 = σ_annual / √(252/30)` scales annual volatility to a 30-day window.

---

## 9. Portfolio Optimization

### Projected Gradient Ascent on Mean-Variance Utility

The portfolio optimizer (`services/portfolio.ts`) maximises:

```
U = μ − A × σ²
```

Where `μ` = expected portfolio return, `σ²` = portfolio variance, and `A` = risk aversion coefficient (derived from the user's risk tolerance setting: low/medium/high → A = 1/3/5).

**Why not closed-form Markowitz MVO?**
Classical Markowitz requires the covariance matrix to be invertible. With fewer than ~30 tickers and short return history, the covariance matrix is frequently rank-deficient (singular), causing `Σ⁻¹` to be numerically unstable or undefined. Projected gradient ascent avoids matrix inversion entirely and converges to the same global maximum (the function is concave) within 500 iterations.

**Simplex projection (Duchi et al., 2008):** After each gradient step, weights are projected back onto the probability simplex (all weights ≥ 0, sum = 1) using the O(n log n) algorithm. This enforces the long-only constraint without penalisation.

**Covariance matrix source:** Daily log returns from a Yahoo Finance raw API endpoint (24h Redis cache). Falls back to a diagonal covariance matrix with assumed `ρ = 0.3` cross-correlation if fewer than 20 observations are available. The Yahoo Finance fallback has the same fragility risk as `yahoo-finance2` — accepted since it's used only for optimization, not real-time data.

---

## 10. Paper Trading

### Design Change: Monte Carlo → Paper Trading

The "Simulate" use case was originally designed as Monte Carlo scenario simulation. Monte Carlo requires OHLCV candle history to sample correlated return paths from a covariance matrix. Finnhub free returns 403 on `/stock/candle`. A simulation built on fabricated covariance data would produce statistically meaningless confidence intervals — not a defensible portfolio showcase feature.

Paper trading only needs a single live quote per ticker — already fetched and cached by the ticker scheduler every minute. The redesign turned a blocked feature into a more useful one: users can create multiple named portfolios, add holdings at a locked-in entry price, and track live P&L over time. Multiple portfolios enable side-by-side strategy comparison.

**P&L calculation:** `(currentPrice − startPrice) / startPrice × 100`. `startPrice` is written at add time from `quote.price` — a point-in-time snapshot. This is intentional: it reflects the actual "I decided to track this now" semantics rather than a hypothetical backdated entry.

---

## 11. WebSocket Server

### `noServer: true` Pattern

The `ws` library defaults to intercepting every HTTP upgrade event on the shared Node.js server. This breaks Next.js Hot Module Replacement in development: HMR uses `/_next/webpack-hmr` as a WebSocket path, and the default `{ server }` mode swallows that upgrade before Next.js can handle it.

The fix: `{ noServer: true }` + a manual `server.on("upgrade")` handler that checks the request path and routes only `/ws` to the WS server. All other upgrade paths pass through to Next.js's handler.

### Authentication Without a Round-Trip

WS upgrade requests carry cookies automatically. The `next-auth.session-token` cookie (or `__Secure-next-auth.session-token` on HTTPS) is decoded directly in the upgrade handler using `@auth/core/jwt`'s `decode()` with `AUTH_SECRET` + the cookie name as salt. This avoids an internal HTTP round-trip to the session API and any circular dependency.

### Vercel Fallback

The custom `server.ts` entry point requires a persistent Node.js process. Vercel serverless functions terminate after each request — no persistent process, no WebSocket. All real-time components include a 60-second polling fallback. The app is fully functional on Vercel; WebSocket is a progressive enhancement.

---

## 12. Push Notifications

### Web Push / VAPID

High-severity alerts are delivered via the Web Push protocol using VAPID authentication. This is zero-cost (no third-party service fee), works with the browser tab closed (via service worker), and appears as a native OS notification.

**Flow:**
1. User enables push → browser registers `/sw.js` → `Notification.requestPermission()` → `PushManager.subscribe()`
2. Subscription (endpoint + keys) POSTed to `/api/v1/notifications/push/subscribe` and stored per-user
3. Alert fires → `sendPushToUser()` sends to all stored endpoints via `webpush.sendNotification()`
4. Service worker handles `push` event → `showNotification()` → OS banner

**High-severity only:** Low and medium alerts are WebSocket-only (in-app). Push notifications for every alert would cause notification fatigue and likely prompt users to revoke permission. Restricting to high-severity preserves the signal-to-noise ratio.

**Circular dependency resolution:** `notifications.ts` needs to import from `services/ws.ts` (for WS broadcast) and `services/push.ts` (for push delivery). Both of those files import from `services/` themselves, creating circular dependencies at module load time. Solved with dynamic `import()` inside the `afterFetchListener` callback — imports resolve at call time, not at module evaluation time.

---

## 13. Frontend Architecture

### Three-Layer Component Model

| Layer | Location | Rule |
|-------|----------|------|
| Page | `app/(pages)/*/page.tsx` | Layout only — compose stateful components, no logic |
| Stateful | `components/stateful/` | Own data fetching and local state |
| UI | `components/ui/` | Stateless — props only, no fetching, no side effects |

This separation makes components independently reusable and keeps pages declarative. A `ui/` component can be rendered in Storybook or a test with no network setup. A `stateful/` component can be moved to a different page without touching its data logic.

### `GroupBtn` Outside Render Scope

An earlier version of `AlertsFeed.tsx` defined the `GroupBtn` sub-component inside the parent's render function. React re-creates component definitions on every render — this resets all state in `GroupBtn` on every parent re-render, causing filter panels to collapse unexpectedly. Moved outside and passed `openGroup`/`onToggle` as props.

### `useLayoutEffect` for Ref Sync

The `useWebSocket` hook synchronises callback refs (e.g. `onMessage`) using `useLayoutEffect` instead of assigning during render. Assigning to a ref during the render phase violates React's rules for side effects. `useLayoutEffect` runs synchronously after DOM mutations and before paint — the correct place for ref synchronisation.

### Dashboard Parallel Fetching with `Promise.allSettled`

The Dashboard fires four concurrent fetch calls on mount — one per quadrant. `Promise.all` would blank the entire page if any single request fails. `Promise.allSettled` is the correct primitive: each quadrant renders independently with its own data or its own error state. A signals timeout doesn't affect the alerts quadrant.

---

## 14. Database Design

### UUID Primary Keys Everywhere
UUIDs prevent enumeration attacks and allow IDs to be generated client-side (optimistic inserts) without a round-trip. The marginal storage cost over integer PKs is negligible at this scale.

### Lazy Asset Population
The `assets` table (ticker metadata: sector, industry, name) is populated lazily when a ticker is first added to any user's watchlist via a Finnhub profile fetch. This avoids a separate bulk import job and means the DB only stores tickers that are actually in use.

### `alertRules` as a Separate Table (Not JSONB)
An earlier design considered storing alert rules as a JSONB column on `alertRule` rows. Separate rows enable indexed queries on `(userId, ticker, ruleType, lastTriggeredAt)` — the primary key for cooldown checks. JSONB would require extracting fields before comparing, adding overhead on the hot path of alert detection.

### `UserNewsRead` Join Table (Not Client-Side Set)
Initial implementation tracked read articles in a client-side `Set<string>`. Read state was lost on page refresh. A `UserNewsRead` join table with a compound PK `(userId, articleId)` provides persistent per-user read tracking. Cascade delete means cleaning up a user account or article automatically removes orphaned rows.

---

## 15. Deployment

### Environment Split: Vercel + Railway/Render

Vercel handles the Next.js app (serverless). Railway or Render runs the custom `server.ts` WebSocket process (persistent Node). The app is fully functional on Vercel alone — components fall back to 60-second polling when WebSocket is unavailable.

### `tsx` in `dependencies` (Not `devDependencies`)
Railway and Render run `npm ci --production` by default, which skips `devDependencies`. `tsx` is the runtime for `server.ts` — moving it to `dependencies` ensures it's present in production builds.

### `postinstall` Runs `prisma generate`
Prisma requires `prisma generate` to produce its TypeScript client after `npm install`. Adding this as a `postinstall` hook ensures the client is generated on every deploy platform automatically, before `next build` runs.

### `AUTH_SECRET` and Cookie Salt
next-auth v5 uses `AUTH_SECRET` + the cookie name as a salt when signing JWTs. The WebSocket server's `decode()` call must use the same salt. On HTTPS, next-auth switches to the `__Secure-` prefixed cookie name — the WS auth handler checks for both.

---

## Summary of Key Tradeoffs

| Decision | Benefit | Cost |
|----------|---------|------|
| Finnhub over yahoo-finance2 | Stable, documented API | No batch quotes; must call once per ticker |
| Token bucket + scored priority queue | User requests never starved by background work | In-memory only; needs Redis for multi-instance |
| Two-timer scheduler | Clean separation of queue management vs execution | Scores computed once/min; mid-cycle spikes wait for next rebuild |
| Quote-only alert detection | No dependency on blocked candle endpoint | Some indicators (RSI, EMA) are approximations |
| RSS over NewsAPI | Free, no rate limits, multiple sources | Less structured metadata; must extract tickers/sentiment ourselves |
| AFINN NLP in Node | No Python microservice | Less sophisticated than transformers; no semantic understanding |
| Gradient ascent MVO | Numerically stable for any portfolio size | 500 iterations per optimize call; weights are fixed constants |
| Paper trading over Monte Carlo | Works without candle history | Less sophisticated than a true simulation |
| noServer WebSocket | HMR unbroken in development | Manual upgrade routing required |
| WebSocket + polling fallback | Works on Vercel serverless | 60s polling is less real-time than push |
| Vercel serverless deploy | Zero-config deploy, CDN edge | No persistent WebSocket process |
