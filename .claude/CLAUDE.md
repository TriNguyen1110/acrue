# CLAUDE.md — ACRUE Project Guide

## Reference Docs

| Doc | What it covers |
|-----|---------------|
| `docs/USE_CASES.md` | 5 use cases with flows, actors, exceptions |
| `docs/API_PLAN.md` | All API endpoints, request/response shapes, background jobs, Node.js libraries |
| `docs/DB_PLAN.md` | PostgreSQL schema, indexes, service-to-table mapping |

---

## Tech Stack

- **Framework:** Next.js (App Router, JS not TS)
- **Runtime:** Node.js
- **DB:** PostgreSQL (`pg`)
- **Cache:** Redis (`ioredis`)
- **Auth:** JWT (`jsonwebtoken` + `bcryptjs`)
- **Market Data:** `yahoo-finance2`
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
lib/                      ← Business logic services
  db.ts                   ← Prisma client (infrastructure)
  cache.ts                ← Redis client (infrastructure)
  auth.ts
  marketData.ts
  search.ts
  notifications.ts        ← includes node-cron scheduler
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
                              External APIs (Yahoo Finance, Polygon, NewsAPI)
```

- **Frontend** only talks to API Routes
- **API Routes** only call lib services
- **Services** read/write DB and Cache
- **Market Data + News** call External APIs
- **Notification System** runs background cron jobs triggering other services

---

## Development Order (Use Case by Use Case)

| Day | Task 1 (Core Logic) | Task 2 (Routes + UI) | Status |
|-----|---------------------|----------------------|--------|
| 1 | DB + Redis + migrations | Auth service + routes + pages | `[ ]` |
| 2 | Market Data service + caching | Watchlist service + routes + page | `[ ]` |
| 3 | Alerts anomaly detection logic | Alerts routes + page + cron wiring | `[ ]` |
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

---

## Documentation Notes

- Keep a running `docs/DECISIONS.md` for any significant change from the original plan
- Before deploying, write a proper `README.md` covering: what the project does, architecture diagram, tech stack, how to run locally, and live demo link
- The architecture diagram (currently in Figma/draw.io) should be exported and included in the README
- Do not mention AI tooling anywhere in public-facing docs
