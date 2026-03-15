# DECISIONS.md — Architectural Decisions & Tradeoffs

A running log of non-obvious decisions made during development, including what alternatives were considered and why we chose what we did. Feeds into the final README.

---

## 2026-03-13 — Asset search is a tag-based recommender + autocomplete, not a plain text search

**Decision:** The asset search (`GET /api/assets/search?q=`) is implemented as two combined mechanisms:
1. **Autocomplete** — Finnhub `/search` provides the candidate pool (up to 10 results, capped at 10 companies max returned to the user)
2. **Tag-based recommender** — candidates are re-ranked by relevance score computed from tag overlap between the query and asset metadata (sector, industry, quoteType)

**Why not plain text search:**
A simple substring match on ticker/name returns results in arbitrary order. For a financial tool, surfacing the most relevant company first matters — searching "tech" should surface large-cap tech equities before obscure funds with "tech" in their name. Tag scoring achieves this without a full search engine.

**Tag scoring logic (`services/search.ts`):**
- Exact ticker match → strong boost
- Sector/industry match → medium boost
- quoteType = EQUITY preferred over ETF/FUND for general queries
- Popularity boost — tickers already in the DB (previously added by any user) ranked higher than cold results
- Results capped at 10

**Tradeoffs:**
- Sector/industry are not returned by Finnhub `/search` — they require a `/stock/profile2` call per result. Fetching profiles for all 10 candidates on every keystroke is too expensive. Instead, sector/industry tags come from the local `assets` DB table (populated when a ticker is first added to any watchlist). Cold tickers (never added before) score on ticker/name match only.
- Autocomplete is debounced on the frontend — no server-side concern needed
- The 10-result cap is both a UX choice (don't overwhelm) and a rate-limit consideration

---

## 2026-03-13 — Replaced `yahoo-finance2` with Finnhub REST API

**Decision:** Use Finnhub's free-tier REST API for all market data instead of `yahoo-finance2`.

**Why we switched:**
`yahoo-finance2` scrapes Yahoo Finance's undocumented internal endpoints. Yahoo has progressively tightened access (cookie authentication, rate limiting, structural changes), making the library fragile — it can break without notice at any time. For a production-grade showcase, an unofficial scraper is not a defensible dependency.

**Alternatives considered:**
| Option | Reason rejected |
|---|---|
| Keep `yahoo-finance2` | Unreliable; breaks silently when Yahoo changes endpoints |
| Polygon.io free tier | 5 req/min hard limit and 15-min delayed data — incompatible with 1-min refresh and real-time alerts |
| Alpha Vantage free | 25 req/day — far too low for any meaningful usage |
| Finnhub free | 60 req/min, real-time data, WebSocket included — viable with a rate limiter |

**Tradeoffs accepted with Finnhub:**
- No native batch quote endpoint — must call `/quote` once per ticker (mitigated by Redis caching and the priority scheduler)
- PE ratio requires a separate `/stock/metric` call (mitigated by a 6h TTL cache — EPS doesn't change often)
- Screener (day gainers/losers/most actives) not available — we compute it ourselves from a curated S&P 100 universe (see below)
- Search results don't include sector/industry — only available via a full profile call per result, which is too expensive for a search typeahead

**Data not available on Finnhub free that was available in `yahoo-finance2`:**
- Real-time volume in the `/quote` response (volume is in candle data instead, cached separately at 10-min TTL)
- `quoteType` (EQUITY/ETF/etc.) — inferred from asset DB on add, not live

---

## 2026-03-14 — Alert retention policy to prevent unbounded DB growth

**Decision:** The nightly cron (03:00 UTC) purges stale alerts in two passes:
1. **TTL delete** — read alerts older than 30 days, unread alerts older than 90 days
2. **Per-user cap** — if a user still has >500 rows after the TTL pass, delete oldest rows (read-first) until they're at the limit

**Why:**
Alert detection runs every 5 minutes with a 60-minute cooldown per rule type. A user with 10 tickers and 3 default rules can generate up to ~720 rows/day. Without a retention policy, the alerts table grows unboundedly — ~260,000 rows/user/year at that rate, which would exhaust a free-tier Postgres allocation (Supabase 500MB) within weeks for an active user base.

**Why two separate TTLs (30 days read, 90 days unread):**
Read alerts have already delivered their value — 30 days is sufficient for historical review. Unread alerts get a longer window because a user who hasn't logged in for a month should still see their missed notifications rather than losing them silently.

**Why the 500-row cap:**
A hard cap backstops edge cases: a user with a very large watchlist or an anomalous market period (e.g. a flash crash triggering every rule simultaneously) can still spike well above what the TTL alone would catch. 500 rows per user is enough history for the UI's pagination and reference needs.

**Tradeoffs:**
- The cap deletes oldest rows first (read before unread), not by importance — in theory a very old high-severity alert could be evicted before a recent low-severity one. Acceptable since the TTL already keeps rows under control in the normal case; the cap is only a safety net.
- The retention job runs in-process with `node-cron` — if the server is down at 03:00 UTC it won't run until the next day. Acceptable; a one-day delay in cleanup has no user-visible impact.

---

## 2026-03-14 — Alert feed enriched with asset classification for ticker-level filtering

**Decision:** `getUserAlerts` joins alert rows with two additional data sources before returning:
1. **`prisma.asset` table** — provides `sector`, `industry`, and `type` (EQUITY / ETP) for each unique ticker in the page
2. **Redis `finnhub:profile:${ticker}` cache** — provides `marketCapitalization` (converted to absolute USD) for cap tier filtering

These fields are attached to each `Alert` DTO and used client-side in `AlertsFeed.tsx` to generate a dynamic second filter row (sector chips, cap tier chips, ETF chip) derived from the current page's alert data.

**Why client-side chips instead of server-side filter params:**
The classification filter values aren't known until alerts are loaded — you can't filter by "Technology" unless you first know that some of the user's alerts have sector = "Technology". Generating chips dynamically from the response data avoids a separate metadata prefetch call and keeps the filter row always in sync with what's actually on screen.

**Why Redis for market cap instead of the Asset table:**
The `Asset` schema stores `sector` and `industry` (populated lazily from Finnhub profiles on watchlist add) but not `marketCap` — market cap changes continuously and adding it to the DB would require either frequent polling or a migration that adds a stale float column. The Finnhub profile cache at `finnhub:profile:${ticker}` (6h TTL) already stores `marketCapitalization` in millions — reading from there is zero-cost and reasonably fresh.

**Tradeoffs:**
- Sector/industry data is only populated for tickers that have been on at least one user's watchlist — cold tickers (never added) won't have classification chips. Acceptable since alerts can only be generated for watchlist tickers anyway.
- Market cap is absent if the Redis profile cache has expired or was never populated. The cap tier chip simply doesn't appear for that ticker rather than showing a stale value.

---

## 2026-03-14 — Continuous float score replaces 3-tier string priority in rate limiter

**Decision:** Refactored `lib/rateLimiter.ts` from three named tiers (`"high"` / `"medium"` / `"low"`) to a single sorted queue keyed by a continuous float score `0.0–1.0`.

**Why:**
The ticker scheduler already computes a continuous urgency score (importance + staleness + volatility + volume spike). Under the 3-tier model, every scheduler-enqueued request was bucketed into `"medium"` regardless of its actual score — two tickers with scores 0.85 and 0.12 would sit in the same tier and drain in FIFO order, defeating the purpose of the scoring formula.

With a single numeric score queue, the scheduler passes its computed score directly to `rateLimiter.enqueue(fn, score)` — higher-scored tickers genuinely pre-empt lower-scored ones within the same drain cycle.

**PRIORITY constants:**
- `PRIORITY.USER = 1.0` — user-initiated requests always pre-empt background work
- `PRIORITY.BACKGROUND = 0.0` — screener universe fetches, profile pre-warming, etc.
- Scheduler score `0.0–1.0` — sits between background and user priority, weighted by actual market signal

**Tradeoffs:**
- Any caller that previously passed a string priority must now pass a number — required a one-time update across all Finnhub lib files and services. No runtime behaviour changed for non-scheduler callers (they all map to `PRIORITY.USER` or `PRIORITY.BACKGROUND`).

---

## 2026-03-13 — Token bucket rate limiter (`lib/rateLimiter.ts`)

**Decision:** Build a token bucket rate limiter with a continuous float priority score to manage Finnhub's 60 req/min limit across all callers (user requests, cron jobs, background scoring).

> **Updated 2026-03-14:** Replaced 3-tier string priority (HIGH/MEDIUM/LOW) with a single sorted queue keyed by a continuous float score `0.0–1.0`. See the 2026-03-14 entry above for rationale.

**Why:**
Without a rate limiter, concurrent user requests + background cron jobs will burst past 60 req/min and receive 429 errors from Finnhub. A simple retry loop would make things worse. A token bucket with scored priority ensures user-facing requests are never starved by background work.

**Design:**
- 55 req/min capacity, not 60 — the 5 req/min headroom absorbs clock skew between our refill timer and Finnhub's server-side rate limit window.
- Token refill: continuous, ~0.917 tokens/sec
- Drain loop: runs every 1s via `setInterval`, highest score first
- `PRIORITY.USER = 1.0` — user-initiated requests
- `PRIORITY.BACKGROUND = 0.0` — background jobs (screener, profile pre-warming)
- Scheduler score `0.0–1.0` — between background and user, reflects actual ticker urgency

**Tradeoffs:**
- In-memory only — a server restart loses the queue state. Acceptable for a single-process Next.js app; a Redis-backed queue would be needed for multi-instance deploys.
- No per-user fairness — a user with a 50-stock watchlist gets more BACKGROUND slots than a user with 5 stocks. Acceptable at this scale.

---

## 2026-03-13 — Scored ticker scheduler (`lib/tickerScheduler.ts`)

**Decision:** Instead of refreshing all watchlist tickers in arbitrary order, run a continuous 1s tick that re-scores all tickers with the current time and enqueues only the single highest-scored eligible ticker per tick into the MEDIUM queue.

**Scoring formula:**
```
importance  = watcherCount / maxWatcherCount        (0–1)  weight 0.35
staleness   = min(ageMs, 60_000) / 60_000           (0–1)  weight 0.25
volatility  = min(|changePct| / 10, 1)              (0–1)  weight 0.25
volumeSpike = min((volume / avgVolume) / 3, 1)      (0–1)  weight 0.15

score = 0.35·importance + 0.25·staleness + 0.25·volatility + 0.15·volumeSpike
```

**Why each signal:**
- **Importance** — tickers watched by more users have higher blast radius if stale; refresh them first
- **Staleness** — data age is the baseline urgency signal
- **Volatility** — a ticker moving 8% needs fresh data more than a flat one; captures active market events
- **Volume spike** — unusual volume often precedes or accompanies price events; supporting signal for urgency

**Why these weights:**
Importance and volatility are the two strongest independent signals of urgency. Staleness is always relevant but shouldn't dominate — a popular ticker that was just fetched 5s ago shouldn't immediately jump the queue again. Volume spike is a weaker corroborating signal.

**Data sources for scoring (all in-memory or DB — no Finnhub API calls):**
- `watcherCount` — DB query run every 60s inside the scheduler; result cached in-memory on the `TickerScheduler` instance
- `lastFetchedAt` — tracked in-memory on the scheduler; updated by `onQuoteFetched()` after each successful fetch. Not read from Redis, which keeps the per-tick scoring loop I/O-free
- `changePct`, `volume`, `avgVolume` — also kept in-memory on the scheduler and updated by `onQuoteFetched()`. On cold start these are 0, so volatility and volumeSpike default to 0 until the first fetch completes

**Why continuous ticking instead of batch-enqueue at cron time:**
An earlier design sorted all tickers at cron time (T=0) and enqueued them all at once. This had a correctness problem: by the time ticker #50 was processed (T=50s), its staleness had increased by 50 seconds but the queue order was already fixed. A ticker that was low-priority at T=0 could become the most urgent at T=30s with no way to move it up.

The current design instead runs a 1s tick that re-scores all tickers with `Date.now()` and enqueues only the single highest-scored eligible ticker. Queue depth stays at 0–1 items, scores are never stale, and a ticker that spikes in volatility mid-cycle immediately jumps to the front on the next tick.

**Tradeoffs:**
- Cold start: `changePct` and `volume` are 0 until the first fetch — volatility and volumeSpike score as 0. The ticker still scores on importance + staleness (staleness = 1.0 since `lastFetchedAt = 0`), so it gets fetched quickly regardless.
- Weights are system constants, not user-configurable. A future improvement could expose them as admin settings.
- `MIN_REFRESH_INTERVAL_MS = 45s` prevents a popular ticker from monopolising the MEDIUM queue every second while low-watcher tickers starve. It is set below 60s so every ticker gets at least one refresh per minute even if its score is always the highest.
- `lastFetchedAt` is reset to `0` on fetch failure so the ticker retries on the next tick rather than being silently skipped for the rest of the cycle.
- Optimistic locking: `lastFetchedAt` is set to `Date.now()` before the Finnhub call is made (not after), preventing the next tick from double-queuing the same ticker while the in-flight request is still pending.

---

## 2026-03-13 — Screener computed from S&P 100 universe

**Decision:** Since Finnhub free doesn't provide screener endpoints (day gainers, losers, most actives), we maintain a hardcoded list of ~100 popular tickers (S&P 100 constituents) and compute the screener by sorting cached quotes.

**Why S&P 100:**
Covers the most actively traded US equities. Users are most likely to discover assets from this list. Hardcoding avoids a dependency on an index-composition API.

**Tradeoffs:**
- Screener only shows S&P 100 — smaller/mid-cap stocks won't appear in discovery widgets
- The S&P 100 list may drift as constituents change — requires occasional manual updates
- 100 quote fetches at LOW priority — processed over ~2 min at 55 req/min when other work is present. Screener data cached at 10-min TTL so this is acceptable.

---

## 2026-03-11 — All compute runs in Node.js (no Python microservice)

**Decision:** All signal scoring, portfolio math, NLP, and statistics run inside the Next.js process using Node.js libraries.

**Libraries used:**
- `technicalindicators` — EMA, RSI, Bollinger, MACD
- `simple-statistics` — z-scores, mean, std dev
- `ml-matrix` — covariance matrix, Cholesky decomposition for Monte Carlo
- `sentiment` / `natural` — AFINN-based NLP scoring

**Tradeoffs:**
- Node math libraries are less battle-tested than pandas/numpy for heavy computation
- All compute runs in the same process — a CPU-intensive signal scoring run could block the event loop (mitigated by keeping batch sizes small and running scoring on a 30-min interval rather than per-request)
- No GPU acceleration — acceptable at this scale

---

## 2026-03-13 — Split `lib/` (infrastructure) from `services/` (business logic)

**Decision:** `lib/` contains only infrastructure — DB client, Redis client, rate limiter, and the Finnhub data access layer. `services/` contains all business logic — auth, signals, portfolio, news, notifications, etc.

**Why:**
A single `lib/` folder mixing infrastructure plumbing with business logic makes it hard to reason about what a file is responsible for. Infrastructure files (`db.ts`, `rateLimiter.ts`) have no business rules; service files (`signals.ts`, `portfolio.ts`) should not contain raw DB connection setup. Keeping them separate enforces the layering: `services/` reads from `lib/`, never the other way around.

**Tradeoffs:**
- Slightly more import paths to maintain (`@/lib/...` vs `@/services/...`)
- The Finnhub layer sits in `lib/` even though it contains some logic (caching, mapping) — this is intentional since it is a data access layer, not a business service. It is analogous to a repository pattern.

---

## 2026-03-13 — Prisma ORM instead of raw `pg`

**Decision:** Use Prisma for DB access instead of raw SQL with `pg`.

**Tradeoffs:**
- Auto-generated TypeScript types from schema keep API responses and DB in sync
- Prisma's query builder covers all needed patterns (joins, aggregates, pagination)
- Adds a build step (`prisma generate`) — acceptable for a TS project
- Slightly more opaque than raw SQL for complex queries — any query Prisma can't express cleanly can fall back to `prisma.$queryRaw`
