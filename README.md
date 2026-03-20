# Acrue — Invest with Clarity

A full-stack stock market intelligence platform built with Next.js, TypeScript, and PostgreSQL. Acrue gives investors a real-time dashboard of their watchlist, AI-powered alert rules, news sentiment analysis, signal scoring, portfolio optimization, and paper trading — all in one place.

---

## Features

- **Real-time quotes** — WebSocket server pushes live price ticks to the UI at up to 55 updates/min
- **Smart alerts** — configurable rules (price change, RSI, volume spike, EMA crossover) with per-user cooldowns and high-severity browser push notifications
- **News sentiment** — RSS + Finnhub company news with AFINN sentiment scoring, ticker tagging, and read-state persistence
- **Signal scoring** — composite score (momentum 35%, analyst 25%, valuation 20%, sentiment 20%) with projected confidence intervals
- **Portfolio analytics** — MPT optimization via projected gradient ascent on `U = μ − Aσ²`, Sharpe ratio, VaR
- **Paper trading** — create fake portfolios, track live P&L against real market prices
- **Push notifications** — opt-in browser push (Web Push / VAPID) for high-severity alerts, works with the tab closed

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL (Neon) + Prisma ORM |
| Cache | Redis (Upstash) via ioredis |
| Auth | next-auth v5 (JWT sessions, Google OAuth) |
| Market data | Finnhub REST API |
| News | Finnhub company news + RSS feeds (Reuters, CNBC, MarketWatch) |
| Indicators | technicalindicators, simple-statistics, ml-matrix |
| NLP | sentiment (AFINN) |
| WebSocket | ws |
| Push | web-push (VAPID) |
| UI | HeroUI + Tailwind CSS v3 |

---

## Architecture

```
Frontend (Next.js App Router)
  └── app/(pages)/*         — page layouts, no logic
  └── components/stateful/  — data-fetching components
  └── components/ui/        — stateless presentational components
  └── hooks/                — custom React hooks (useWebSocket)

API Layer
  └── app/api/v1/*          — thin route handlers, auth guard, delegate to services

Services (business logic)
  └── services/alerts.ts          — anomaly detection, rule evaluation
  └── services/notifications.ts   — alert lifecycle + WS/push dispatch
  └── services/tickerScheduler.ts — two-timer rate-limited quote fetcher (≤55 req/min)
  └── services/signals.ts         — composite signal scoring
  └── services/news.ts            — NLP pipeline + RSS ingestion
  └── services/portfolio.ts       — MPT optimization
  └── services/simulate.ts        — paper trading portfolios
  └── services/ws.ts              — WebSocket server
  └── services/push.ts            — Web Push delivery

Infrastructure (lib/)
  └── lib/finnhub/   — Finnhub data access layer (quote, chart, search, summary, screener)
  └── lib/cache.ts   — Redis client
  └── lib/db.ts      — Prisma client
  └── lib/rateLimiter.ts — token bucket rate limiter with scored priority queue
```

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL database (or [Neon](https://neon.tech) free tier)
- Redis instance (or [Upstash](https://upstash.com) free tier)
- [Finnhub](https://finnhub.io) API key (free tier)
- Google OAuth credentials (optional — for Google sign-in)

### 1. Clone and install

```bash
git clone https://github.com/TriNguyen1110/acrue.git
cd acrue
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `AUTH_SECRET` | Random 32+ char secret for next-auth |
| `FINNHUB_API_KEY` | Finnhub free tier API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `VAPID_PUBLIC_KEY` | VAPID public key for push notifications |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `VAPID_MAILTO` | Contact email e.g. `mailto:you@example.com` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Same as `VAPID_PUBLIC_KEY` (exposed to client) |

Generate VAPID keys:
```bash
npx web-push generate-vapid-keys
```

### 3. Database

```bash
npx prisma db push
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/          — Next.js App Router (pages + API routes)
components/   — React components (ui/ stateless, stateful/ data-fetching)
hooks/        — Custom React hooks
lib/          — Infrastructure (DB, Redis, rate limiter, Finnhub client)
services/     — Business logic
types/        — Shared TypeScript interfaces
docs/         — Architecture and planning docs
prisma/       — Database schema
public/       — Static assets
scripts/      — Dev utilities (not for production use)
```
