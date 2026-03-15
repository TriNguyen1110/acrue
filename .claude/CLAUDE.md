# CLAUDE.md — ACRUE Project Guide

## Reference Docs

| Doc | What it covers |
|-----|---------------|
| `.claude/DESIGN.md` | Full design system — colors, fonts, effects, component patterns |
| `docs/USE_CASES.md` | 5 use cases with flows, actors, exceptions |
| `docs/API_PLAN.md` | All API endpoints, request/response shapes, background jobs, Node.js libraries |
| `docs/DB_PLAN.md` | PostgreSQL schema, indexes, service-to-table mapping |
| `docs/DECISIONS.md` | Architectural decisions and tradeoffs log |

---

## Tech Stack

- **Framework:** Next.js (App Router, JS not TS)
- **Runtime:** Node.js
- **DB:** PostgreSQL (`pg`)
- **Cache:** Redis (`ioredis`)
- **Auth:** JWT (`jsonwebtoken` + `bcryptjs`)
- **Market Data:** Finnhub REST API (`FINNHUB_API_KEY` env var) — replaces `yahoo-finance2`
- **Indicators:** `technicalindicators`
- **Stats/Math:** `simple-statistics`, `ml-matrix`
- **NLP:** `sentiment`, `natural`
- **Scheduler:** `node-cron` (lives inside Notification System)
- **WebSocket:** `ws`

---

## Project Structure

```
app/
  api/                    ← API routes (thin controllers)
    auth/
    watchlist/
    alerts/
    news/
    signals/
    portfolio/
  (pages)/                ← Frontend pages (one folder per use case)
    dashboard/
    watchlist/
    alerts/
    news/
    signals/
    portfolio/
  providers.tsx           ← HeroUIProvider wrapper
lib/                      ← Infrastructure only (no business logic)
  db.ts                   ← Prisma client
  cache.ts                ← Redis client
  rateLimiter.ts          ← Token bucket rate limiter (55 req/min, 3-tier priority queue)
  finnhub/                ← Finnhub API data access layer
    client.ts             ← Base fetch routed through rateLimiter
    quote.ts              ← Live quotes (60s TTL)
    chart.ts              ← OHLCV candles (interval-based TTL)
    search.ts             ← Ticker/name search (1h TTL)
    summary.ts            ← Company profile + analyst rating (6h TTL)
    screener.ts           ← Gainers/losers/most-active from S&P 100 universe
    index.ts              ← Barrel export
services/                 ← Business logic (reads from lib/, writes to DB/Cache)
  tickerScheduler.ts      ← Two-timer scheduler: 60s queue rebuild (score all tickers) + ~1091ms drain (pop + fetch, ≤55/min)
  auth.ts
  marketData.ts
  search.ts               ← Tag-based recommender + autocomplete (Finnhub candidates re-ranked by sector/industry/quoteType, max 10)
  notifications.ts        ← node-cron for daily alert retention only; alert detection wired to tickerScheduler afterFetchListener
  news.ts
  signals.ts
  portfolio.ts
  ws.ts
components/               ← Reusable UI components
  ui/                     ← Stateless, pure presentational components
    StockCard.tsx
    AlertBadge.tsx
    SignalBar.tsx
    PriceChange.tsx
    ...
  stateful/               ← Stateful components (fetching, local state)
    WatchlistTable.tsx
    AlertsFeed.tsx
    SignalScoreList.tsx
    PortfolioChart.tsx
    ...
docs/                     ← Planning docs
```

### Frontend Component Rules

- **`components/ui/`** — stateless, no fetching, no side effects, props only. Reusable anywhere.
- **`components/stateful/`** — own their data fetching or local state. Used inside pages.
- **`app/(pages)/*/page.tsx`** — page-level layout only. Compose stateful components, no logic.
- Never fetch data inside a `ui/` component.
- Never put page layout inside a `stateful/` component.

---

## Architecture Layers

```
Frontend → API Routes → Services → Infrastructure (DB + Cache)
                                         │
                              External APIs (Finnhub, NewsAPI)
```

- **Frontend** only talks to API Routes
- **API Routes** only call `services/`
- **Services** contain business logic, read/write DB and Cache
- **`lib/`** is infrastructure only — DB client, Redis client, rate limiter, Finnhub data access
- **Notification System** owns background jobs: tickerScheduler drives quote refreshes + alert detection at ≤55/min; node-cron only used for daily alert retention

---

## Development Order (Use Case by Use Case)

| Day | Task 1 (Core Logic) | Task 2 (Routes + UI) | Status |
|-----|---------------------|----------------------|--------|
| 1 | DB + Redis + migrations | Auth service + routes + pages | `[x]` |
| 2 | Market Data service + caching | Watchlist service + routes + page | `[x]` |
| 3 | Alerts anomaly detection logic | Alerts routes + page + cron wiring | `[x]` |
| 4 | News NLP + sentiment pipeline | News routes + page | `[ ]` |
| 5 | Signals scoring logic | Signals routes + page | `[ ]` |
| 6 | Portfolio metrics + optimization | Portfolio routes + page | `[ ]` |
| 7 | Monte Carlo simulation | Simulate routes + UI | `[ ]` |
| 8 | WebSocket server | Wire quotes + alerts into pages | `[ ]` |
| 9 | Deploy + env config | Smoke test + fix issues | `[ ]` |
| 10 | Bug fixes + polish | README + architecture diagram | `[ ]` |
| 11 | Dashboard page + summaries | Navigation + layout polish | `[ ]` |
| 12 | Performance — query optimization + caching audit | Rate limiting + error handling review | `[ ]` |
| 13 | End-to-end walkthrough + fix remaining bugs | Final UI polish + mobile responsiveness | `[ ]` |
| 14 | Demo video / screenshots | Final README + live deploy check | `[ ]` |

---

## Agent Guidelines

When running multiple agents in parallel:

- **Each agent should own one layer** — don't have two agents touching the same file
- **Safe to parallelize:**
  - One agent on `lib/` service, another on `app/api/` route for a different use case
  - One agent on frontend page, another on backend service for a different use case
- **Do NOT parallelize:**
  - Two agents on the same lib file
  - Two agents on DB migrations simultaneously
  - Two agents on `lib/db.js` or `lib/cache.js`

### Suggested parallel splits per use case:
```
Agent A: lib/[service].js
Agent B: app/api/[route]/route.js
Agent C: app/(pages)/[page]/page.js  ← only after API is done
```

---

## Conventions

- TypeScript throughout — `.ts` for lib/api, `.tsx` for components/pages
- No Python — all compute runs in Node
- No separate microservices — everything in one Next.js app
- `lib/db.js` = connection pool only, no business logic
- `lib/cache.js` = Redis client only, no business logic
- Each lib service owns its own DB queries
- Error format: `{ "error": "code", "message": "..." }` + standard HTTP codes
- Pagination: `?page=1&limit=20`
- API prefix: `/api/v1/...` (add from the start)
- UUID primary keys everywhere
- All routes are protected by JWT except `/api/auth/register` and `/api/auth/login`

---

## Git & Commit Guidelines

This project is a hiring showcase — commits are part of the story.

- **Commits must be meaningful** — describe what was built and why, not just "fix" or "update"
- **Commit per logical unit** — one commit per feature/service/page, not one giant commit
- **No AI mentions** — do not reference Claude, AI, or code generation in any commit message, comment, or doc
- **Good commit format:**
  ```
  Add signal scoring logic with weighted momentum and volume indicators

  Add news ingestion with AFINN sentiment analysis and ticker extraction

  Fix alert cooldown not resetting after rule update
  ```

---

## Decision Log

Record important architectural or implementation decisions here as the project evolves. This feeds into the final README and any writeup.

Full tradeoff notes in `docs/DECISIONS.md`.

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-11 | No Python microservice — all compute in Node | Simpler stack, Node libraries sufficient for this scale |
| 2026-03-13 | Switched to TypeScript | Better type safety, more professional for hiring showcase |
| 2026-03-13 | Using Prisma instead of raw SQL migrations | Auto-generated types, cleaner schema management |
| 2026-03-13 | Using HeroUI + Tailwind v3 | Modern component library, requires Tailwind v3 (incompatible with v4) |
| 2026-03-13 | Frontend split: pages / stateful components / ui components | Clear separation of concerns, easier to parallelize agent work |
| 2026-03-11 | No `assets` table — fetch live from Yahoo Finance, cache in Redis | Avoids stale data, reduces DB complexity |
| 2026-03-11 | `alert_rules` stored as JSONB inside `alerts` | No need for separate table at this scale |
| 2026-03-11 | Scheduler lives inside Notification System | Keeps background jobs co-located with the service that owns them |
| 2026-03-13 | Replaced `yahoo-finance2` with Finnhub REST API | Yahoo Finance unofficial API is unreliable; Finnhub free tier provides real-time data + WebSocket |
| 2026-03-13 | Token bucket rate limiter with scored ticker scheduler | Finnhub free tier capped at 60 req/min; priority queue maximizes data freshness within budget |
| 2026-03-13 | Split `lib/` (infrastructure) from `services/` (business logic) | `lib/` = DB, Redis, rate limiter, Finnhub data access. `services/` = auth, signals, portfolio, etc. Cleaner separation of concerns |
| 2026-03-14 | `price_change` alert uses 5-min candle interval instead of `previousClose` | Catches sudden intraday spikes, not slow drifts over the day. Default threshold lowered from 5% → 2% accordingly |
| 2026-03-14 | Alert detection driven by `tickerScheduler.afterFetchListener` instead of a 5-min cron | Detection runs up to 55×/min, always on freshly cached quote data; no separate polling loop needed |
| 2026-03-14 | `tickerScheduler` rebuilt as two-timer: 60s queue rebuild + ~1091ms drain | Queue refreshed once/min (new tickers added, scores recalculated); drain fires API calls at up to 55/min matching the rate-limit budget. Fewer tickers → fewer calls, never wastes budget |

---

## Design System

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `gold-400` | `#F7F3E5` | Primary accent — text, icons, borders |
| `gold-500` | `#EDE4CC` | Slightly darker gold for gradients |
| `gold-600` | `#D4CCAE` | Muted gold, button gradient start |
| `navy-900` | `#050D1A` | Page background |
| `navy-800` | `#0A1628` | Card / surface background |
| `navy-700` | `#0F1F38` | Elevated surface |
| `navy-600` | `#152848` | Border, divider |

### Typography
| Role | Font | Weight |
|------|------|--------|
| Headings (`h1`, `h2`, `h3`) | DM Serif Display | 400 |
| Body | Inter | 300–600 |
| Numbers / code | DM Mono | 300–500 |

### Effects
- **Gold glow on text** — `text-shadow: 0 0 24px rgba(247,243,229,0.25), 0 0 48px rgba(247,243,229,0.08)` — applied to all `h1` globally
- **Gold glow on elements** — use `.glow-gold`, `.glow-gold-sm`, `.glow-gold-lg` utility classes
- **Gold border glow** — `rgba(247,243,229,0.15)` for borders, `rgba(247,243,229,0.1)` for dividers
- **Background radial** — `radial-gradient(ellipse 60% 40% at 50% 0%, rgba(247,243,229,0.07) 0%, transparent 70%)` on auth pages

### Vibe
- Dark, data-dense, high-tech but refined — think Bloomberg meets old money
- Navy is the foundation, gold is used sparingly as accent only
- Buttons: gold gradient (`#EDE4CC` → `#F7F3E5`) with gold glow, dark navy text
- Inputs: focus state uses gold border + subtle gold ring
- Sidebar brand: centered, `Acrue` in DM Serif Display, slogan "Invest with clarity"

---

## Documentation Notes

- Keep a running `docs/DECISIONS.md` for any significant change from the original plan
- Before deploying, write a proper `README.md` covering: what the project does, architecture diagram, tech stack, how to run locally, and live demo link
- The architecture diagram (currently in Figma/draw.io) should be exported and included in the README
- Do not mention AI tooling anywhere in public-facing docs
