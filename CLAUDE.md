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
  api/              ← API routes (thin controllers)
    auth/
    watchlist/
    alerts/
    news/
    signals/
    portfolio/
  (pages)/          ← Frontend pages
lib/                ← Business logic services
  db.js             ← PostgreSQL pool (infrastructure)
  cache.js          ← Redis client (infrastructure)
  auth.js
  marketData.js
  search.js
  notifications.js  ← includes node-cron scheduler
  news.js
  signals.js
  portfolio.js
  ws.js
docs/               ← Planning docs
```

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

| Day | Task | Status |
|-----|------|--------|
| 1 | Foundation — DB, Redis, migrations, Auth (service + routes + pages) | `[ ]` |
| 2-3 | UC1 — Watchlist (Market Data, service, routes, page) | `[ ]` |
| 4-5 | UC2 — Alerts (service, anomaly detection, cron, routes, page) | `[ ]` |
| 6-7 | UC3 — News (NewsAPI, NLP, routes, page) | `[ ]` |
| 8-9 | UC4 — Signals (scoring logic, routes, page) | `[ ]` |
| 10-11 | UC5 — Portfolio (metrics, optimize, Monte Carlo, routes, page) | `[ ]` |
| 12 | WebSocket — live quotes + alert push | `[ ]` |
| 13 | Deploy — Vercel + managed PostgreSQL + Redis | `[ ]` |
| 14 | Buffer — bug fixes, polish | `[ ]` |

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

- JS not TS
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
