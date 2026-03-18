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

## 2026-03-15 — Trusted source allowlist for Finnhub company news

**Decision:** Articles ingested from Finnhub `/company-news` are filtered through a `TRUSTED_SOURCES` Set before being persisted. Only articles whose `source` field (case-insensitive) matches a known reputable outlet are stored.

**Trusted outlets include:** Reuters, Bloomberg, CNBC, MarketWatch, WSJ, Financial Times, AP, Barron's, Seeking Alpha, Yahoo Finance, Investing.com, Benzinga, The Motley Fool, Business Insider, Forbes, Fortune.

**Why:**
Finnhub aggregates company news from hundreds of sources, including low-quality blogs, press-release syndication services, and sites with no editorial standards. For a portfolio showcase, surfacing low-credibility articles would undermine the tool's usefulness and reflect poorly on the data pipeline design.

**Tradeoffs:**
- Articles from legitimate but unlisted sources are silently dropped — this is intentional. The allowlist can be extended as needed, but defaults conservative.
- If Finnhub changes its source naming conventions, entries may not match. Mitigated by lowercasing both sides before comparison.

---

## 2026-03-15 — Word-boundary regex for ticker extraction to prevent single-letter false positives

**Decision:** The `extractTickers` NLP function uses two guards against spurious single-letter ticker matches:
1. **Minimum ticker length:** any ticker shorter than 2 characters is skipped entirely
2. **Word-boundary regex:** tickers are matched with `(?<![A-Z])${t}(?![A-Z])` — a letter immediately adjacent to another uppercase letter (e.g. "APPLIED" containing "A") is not counted as a ticker match
3. **Minimum company name length:** company names shorter than 5 characters are not used for name-based matching

**Why:**
Single-letter tickers exist on US markets (F = Ford, S = Sprint/T-Mobile, M = Macy's, etc.). Without guards, every occurrence of the letter "F" in any financial article would match the Ford ticker, producing meaningless ticker tags on nearly every article.

**Tradeoffs:**
- The word-boundary regex uses a lookbehind/lookahead that checks for adjacent uppercase letters, not true word boundaries — this means mixed-case text ("Ford") is handled by the name-matching path, not the ticker path. Correct behaviour.
- Single-letter tickers are still validly extractable from all-caps contexts (e.g. "F reported earnings") — the regex allows this since "F" surrounded by spaces has no adjacent uppercase letters. However, given the noise risk, single-letter tickers are excluded by the length guard regardless. This means Ford, Sprint, etc. are only tagged via the name-matching path (name length ≥ 5 chars), which is more reliable.

---

## 2026-03-15 — Non-fatal ticker extraction in the news ingest pipeline

**Decision:** If `getAssets()` (the DB lookup that loads the ticker→name map) throws an error during article ingestion, `extractTickers` catches the error and returns an empty array rather than propagating the exception.

Additionally, `assetCache` is reset to `null` on failure so the next call retries the DB query rather than serving a stale null cache.

**Why:**
The Prisma PgAdapter driver (used in some execution contexts) has known compatibility gaps with certain query patterns. If asset lookup fails for any reason, it is better to store the article with no ticker tags than to silently discard the article entirely — the NLP pipeline can still extract sentiment, topics, and impact without ticker data.

**Tradeoffs:**
- Articles stored during an asset-lookup outage will have `tickers: []` and won't appear when filtered by ticker. They will still appear in macro topic feeds and unfiltered views.

---

## 2026-03-15 — `hasSome` instead of `isEmpty: false` for Prisma array filter

**Decision:** The `getNewsForUser` query uses `{ topics: { hasSome: ALL_TOPICS } }` instead of `{ topics: { isEmpty: false } }` to gate macro-topic relevance.

**Why:**
`isEmpty: false` is not supported by the PrismaPg driver adapter — it silently fails or throws at runtime depending on the Prisma version. `hasSome: ALL_TOPICS` (where `ALL_TOPICS` is the explicit list of all topic keys) is semantically equivalent and universally supported across all Prisma drivers.

**Tradeoffs:**
- `ALL_TOPICS` must be kept in sync with `TOPIC_KEYWORDS` in `services/news.ts`. Adding a new topic keyword requires updating both constants. Acceptable; both live in the same file.

---

## 2026-03-15 — Immediate RSS ingest on server startup

**Decision:** `services/notifications.ts` fires `ingestRssFeeds()` immediately when the module loads, in addition to the four scheduled cron windows (07:00, 09:30, 12:00, 16:30 ET).

**Why:**
The scheduled cron fires at fixed clock times. On first run, if the server starts at 14:00, the next scheduled fetch isn't until 16:30 — meaning the news feed shows no articles for 2.5 hours. A startup ingest populates the DB immediately, so the feed is non-empty from the first page load.

**Tradeoffs:**
- Startup ingest adds a small delay at boot time (RSS fetch + NLP pipeline). Non-blocking — uses `Promise` with `.then()/.catch()` so it doesn't hold up the server start.
- If the server crashes and restarts frequently, each restart triggers an ingest — no harm done since articles are upserted by URL, not duplicated.

---

## 2026-03-15 — AP Business replaces Reuters as RSS source

**Decision:** The Reuters RSS feed (`feeds.reuters.com`) was replaced with AP Business (`feeds.apnews.com/rss/apf-business`).

**Why:**
Reuters' public RSS endpoint (`feeds.reuters.com`) returns `ENOTFOUND` — the domain no longer resolves. Reuters has progressively moved content behind authenticated feeds and eventually removed the public RSS. AP Business is a wire service of equivalent quality and reliability, with a stable free RSS endpoint.

**Tradeoffs:**
- AP uses a slightly different XML structure — `rss-parser` normalises it transparently.

---

## 2026-03-15 — Gmail-style read state in the news feed (client-side)

**Decision:** Articles the user has expanded (opened) are tracked in a `Set<string>` of article IDs held in React state (`readIds`). The feed re-sorts on every render: unread articles appear first, read articles sink to the bottom and are dimmed to 50% opacity with a darker background.

**Why:**
Financial news has a strong recency/attention signal. Once a user has read a headline, they don't need it competing visually with new unread items. The Gmail model (read items sink, unread items float) is immediately intuitive and requires no explicit "mark as read" button.

**Why client-side state (not persisted to DB):**
- Adding a `news_read` table and an API endpoint adds significant complexity for a UX convenience feature
- News relevance decays within hours — whether a user read an article during this session is what matters, not across sessions
- The `Set<string>` approach is zero-latency (no network call on expand)

**Tradeoffs:**
- Read state is lost on page refresh. Acceptable — fresh visit, fresh attention.
- `readIds` grows monotonically within a session; no cleanup needed since the page is paginated and the set size is bounded by items loaded.

---

## 2026-03-15 — RSS feeds instead of NewsAPI for macro news

**Decision:** Use `rss-parser` to consume public RSS feeds from Reuters, CNBC, MarketWatch, Yahoo Finance, and Seeking Alpha for macro/general financial news instead of NewsAPI.

**Why not NewsAPI:**
- Free tier is capped at **100 requests/day** — with ~8 macro topic queries per cycle and 4 ingest cycles/day, that's 32 req/day which fits, but any growth (more topics, more frequent polling) would immediately hit the ceiling
- Cannot use multiple API keys without violating ToS (one account per person/organisation)
- Paid tier ($449/mo) is not justified for a portfolio project
- Content is still truncated — NewsAPI intentionally cuts article text at ~200 chars regardless of plan

**Why RSS:**
- **Free with no rate limits** — major outlets publish RSS as a public standard, no API key required
- **Multiple reputable sources** — Reuters, CNBC, MarketWatch, Yahoo Finance, Seeking Alpha are all tier-1 financial news sources
- **Same data shape** — title + description/snippet + source + published date, which is all we need for sentiment analysis and ticker extraction
- **`rss-parser`** (npm) handles all XML parsing — one-line call to get a clean JS array

**Polling schedule (4× daily, market-aligned):**
| Time (ET) | Reason |
|-----------|--------|
| 07:00 | Pre-market — overnight news before US open |
| 09:30 | Market open |
| 12:00 | Midday — Fed/macro releases often around here |
| 16:30 | Post-close — earnings and after-hours news |

**Ticker-specific news** still comes from Finnhub `/company-news` (already integrated, rate-limited) every 15 min.

**Tradeoffs:**
- RSS gives less structured metadata than a dedicated news API (no topic tags, no sentiment pre-computed) — we extract tickers and compute sentiment ourselves, which we were already doing
- RSS feed structure varies slightly between sources — `rss-parser` normalises the common fields but edge cases (custom XML namespaces) may require per-source field mapping
- No search/filter capability — we ingest everything from the feed and filter in-process

---

## 2026-03-15 — tickerScheduler rebuilt as two-timer model

**Decision:** Replaced the 1s dynamic-pick tick with two separate timers:
1. **60s rebuild** — queries DB, syncs watcher counts, re-scores all tickers, produces a freshly sorted priority queue
2. **~1091ms drain (60 000 ÷ 55)** — pops one item per slot and fires a rate-limited Finnhub quote fetch

**Why:**
The previous 1s tick re-scored all tickers on every tick to find the single best candidate. While accurate, it mixed two concerns — queue management (what needs fetching) and execution (actually fetching). The two-timer model separates them cleanly: the rebuild timer owns the queue, the drain timer owns execution.

The drain interval is derived directly from the rate budget: `60 000ms ÷ 55 req/min ≈ 1091ms`. If the queue has fewer than 55 tickers, drain slots no-op — the system naturally uses only what it needs and never wastes budget.

**Tradeoffs:**
- Scores are computed once per minute rather than continuously — a ticker that spikes in volatility mid-cycle won't move up until the next rebuild. Acceptable; the 60s window matches the quote cache TTL anyway.
- Between rebuilds, the queue drains sequentially. With <55 tickers it empties well before the next rebuild, leaving drain slots idle. This is intentional — it means each ticker gets exactly one fresh fetch per minute, not spam.

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

## 2026-03-16 — Sentiment score is normalised to [0, 1] before storage (not raw AFINN)

**Decision:** `NewsArticle.sentimentScore` stores a normalised float in `[0, 1]`, not the raw AFINN integer sum.

**How it works (`services/news.ts → scoreSentiment()`):**
1. `sentiment.analyze(headline + summary)` returns a raw AFINN score — the sum of individual word scores (each word is −5 to +5 in the lexicon).
2. Normalise: `raw = afinnSum / (wordCount × 5)` — divides by the theoretical maximum, giving a per-word average in `[−1, +1]`.
3. Clamp to `[−1, +1]` (guards against outlier articles with very few words).
4. Remap to `[0, 1]`: `score = (clamped + 1) / 2` — 0 = very negative, 0.5 = neutral, 1 = very positive.

**Why normalise before storing:**
- Raw AFINN sums vary wildly with article length — a 500-word article will score much higher than a 50-word headline even if both express the same sentiment intensity. Normalising by word count removes this length bias.
- A `[0, 1]` float is easier to threshold and display than an unbounded integer.

**Impact classification** (`scoreImpact(score)`) is derived from distance from neutral (0.5):
- `score > 0.75 or < 0.25` → `"high"` (strong directional signal)
- `score > 0.60 or < 0.40` → `"medium"`
- otherwise → `"low"`

**Signal scoring integration (`services/signals.ts → scoreNewsSentiment()`):**
- Fetches articles tagged with the ticker from the last 7 days.
- Computes a **weighted average** of `sentimentScore` values, weighting by impact (`high=2, medium=1, low=0.5`) so high-conviction articles dominate.
- Maps `[0, 1] → [0, 100]` directly (`avg × 100`) — neutral articles produce ~50, clearly positive ~70–85, clearly negative ~15–30.

---

## 2026-03-17 — Dashboard fetches four data sources in parallel with `Promise.allSettled`

**Decision:** `DashboardOverview` fires four concurrent fetch calls on mount using `Promise.allSettled`, one per quadrant (alerts, signals, watchlist/movers, news). Each result is applied independently — a failure in one does not prevent the others from rendering.

**Why `allSettled` not `Promise.all`:**
`Promise.all` rejects as soon as any one request fails. On the Dashboard — which aggregates data from every service — a signals timeout or a temporary news DB issue would blank the entire page. `allSettled` is the correct primitive here: each quadrant is independently useful even without the others.

**Tradeoffs:**
- Four concurrent requests on page load vs. one aggregated endpoint — a future `/api/v1/dashboard` route could batch all four queries server-side, reducing client round-trips and allowing server-side caching. Not done now to avoid over-engineering; the four API routes already exist and the page loads fast enough with parallelism.

---

## 2026-03-17 — Paper trading portfolios instead of Monte Carlo simulation

**Decision:** The "Simulate" use case was redesigned from Monte Carlo scenario simulation to paper trading portfolios — users can create multiple named portfolios, add holdings with a locked-in start price, and track live P&L against real market prices over time.

**Why the change:**
Monte Carlo simulation requires OHLCV candle history to build a covariance matrix and sample correlated return paths. Finnhub free tier returns 403 on `/stock/candle`. Without historical returns the simulation would be statistically unsound (a fake covariance matrix would give fake confidence intervals). Paper trading, by contrast, only needs a single live quote per ticker — already fetched and cached by `tickerScheduler` every minute.

**How it works:**
- `startPrice` is written to `SimulatedHolding` at the moment the user adds a holding (locked-in snapshot of `quote.price`)
- `currentPrice` fetched live from `/api/v1/assets/:ticker/quote` via `enrichHoldings()` on every GET
- P&L = `(currentPrice − startPrice) / startPrice × 100`
- Multiple portfolios per user, each independently tracked — enables strategy comparison

**Tradeoffs:**
- Start price is a point-in-time snapshot; it reflects the price at add time not a hypothetical purchase. Users who add a holding after a 10% run-up see that embedded in their P&L. This is intentional — it reflects actual "I decided to track this now" semantics.
- `enrichHoldings()` fires one quote fetch per holding in `Promise.allSettled` — no batching. Acceptable at the scale of a paper portfolio (typically <20 holdings).

---

## 2026-03-17 — Alerts topic filter uses ticker's own industry categories

**Decision:** The "Topic" filter in the Alerts feed is populated with the industry classifications of the user's watchlisted tickers (e.g., "Software", "Biotechnology", "Banks"), not macro news topics (Fed, Inflation, etc.).

**Why industry, not macro topics:**
An earlier implementation bridged alerts → news articles → `NewsArticle.topics` to derive which macro topics were relevant for each alert ticker. This added latency (an extra DB join through news articles), required news articles to exist before any topics appeared, and produced coarse-grained results (many tickers have "earnings" in their news regardless of industry). Industry is a stable, direct property of every ticker populated at watchlist-add time via the Finnhub profile — no joins needed, always available.

**Filter mechanics:**
- `options.industries` returned by `GET /api/v1/alerts/filters` lists all distinct industries from the combined alert-ticker + watchlist-ticker set
- Selecting an industry chip filters `alerts` to those where `alert.industry === selectedIndustry`
- `alert.industry` is joined from the `Asset` table in `getUserAlerts()` enrichment

**Tradeoffs:**
- Industry is more granular than sector (30+ industries vs 11 sectors) — this is a feature, not a bug, since users watching multiple tech sub-sectors (Software vs Semiconductors) can now distinguish them

---

## 2026-03-17 — Alert filter options query combines alert tickers and watchlist tickers

**Decision:** `getAlertFilterOptions()` now fetches distinct tickers from both the `Alert` table and the `Watchlist` table before querying `Asset` for sector/industry/type data. The `tickers` field in the response (used for Ticker filter chips) is still alert-tickers only; the extended set is used only to populate the Topic (industry) and Sector chips.

**Why:**
If a user has 10 tickers on their watchlist but alerts have only fired for 3 of them, the industry filter would show only 3 tickers' worth of industries — missing the categories of the other 7 tickers entirely. Since the filter's purpose is to let users narrow their view by the kinds of companies they're tracking (not just the ones that have happened to alert), the full watchlist is the right scope.

**Tradeoffs:**
- Two DB queries (alerts + watchlist) instead of one — negligible overhead; both are indexed by `userId` and return small row counts.
- The `tickers` chip list (Ticker filter group) intentionally stays alert-only: there's no point showing a ticker chip for a stock that has no alerts to filter.

---

## 2026-03-17 — Portfolio MPT optimization uses projected gradient ascent

**Decision:** `optimizePortfolio()` maximises the mean-variance utility function `U = μ − A×σ²` (where A = risk aversion coefficient derived from the user's risk setting) using projected gradient ascent with simplex projection.

**Simplex projection (Duchi et al., 2008):** After each gradient step, weights are projected back onto the probability simplex (all weights ≥ 0, sum = 1) via the efficient O(n log n) algorithm.

**Why not closed-form MVO:**
Classical Markowitz optimization solves a quadratic program analytically, but requires the covariance matrix to be invertible. With fewer than ~30 tickers and short history, the covariance matrix is often rank-deficient (singular), causing numerical instability. Gradient ascent is stable for any portfolio size, requires no matrix inversion, and converges to the same global maximum (the function is concave) within 500 iterations.

**Covariance matrix source:**
Daily log returns from Yahoo Finance (unofficial raw API, 24h Redis cache). Falls back to diagonal covariance (each ticker's own variance only, ρ=0.3 cross-correlation assumed) if fewer than 20 observations are available.

**Tradeoffs:**
- 500 iterations × O(n) per step = O(500n) — negligible for portfolios up to a few hundred tickers
- Yahoo Finance raw API for historical prices could break (same fragility risk as `yahoo-finance2`); acceptable since it's only used for optimization, not real-time data

---

## 2026-03-13 — Prisma ORM instead of raw `pg`

**Decision:** Use Prisma for DB access instead of raw SQL with `pg`.

**Tradeoffs:**
- Auto-generated TypeScript types from schema keep API responses and DB in sync
- Prisma's query builder covers all needed patterns (joins, aggregates, pagination)
- Adds a build step (`prisma generate`) — acceptable for a TS project
- Slightly more opaque than raw SQL for complex queries — any query Prisma can't express cleanly can fall back to `prisma.$queryRaw`
