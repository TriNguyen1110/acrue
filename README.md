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
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                            │
│  pages/  ·  stateful components  ·  ui components  ·  useWebSocket │
└────────────────────┬──────────────────────┬────────────────────────┘
          REST /api/v1/*               WS /ws
┌────────────────────▼──────────────────────▼────────────────────────┐
│                    Node.js Server (server.ts)                       │
│                                                                     │
│  API Routes (app/api/v1/*)          WebSocket (services/ws.ts)      │
│    auth · watchlist · alerts          live quote ticks              │
│    news · signals · portfolio         alert broadcasts              │
│    simulate · push                                                  │
│                                                                     │
│  Services                                                           │
│    tickerScheduler  ──► rateLimiter ──► Finnhub REST API            │
│    notifications    ──► ws.ts (broadcast) + push.ts (VAPID)         │
│    alerts           ──► anomaly detection (quote-based)             │
│    news             ──► NLP pipeline (AFINN sentiment)              │
│    signals          ──► composite scoring (4 components)            │
│    portfolio        ──► MPT optimization (gradient ascent)          │
│    simulate         ──► paper trading (live P&L)                    │
│                                                                     │
│  Infrastructure (lib/)                                              │
│    finnhub/  ·  rateLimiter  ·  db (Prisma)  ·  cache (Redis)       │
└──────────┬─────────────────────────────┬───────────────────────────┘
           │ PostgreSQL (Neon)            │ Redis (Upstash)
┌──────────▼──────────┐       ┌──────────▼──────────┐
│  PostgreSQL          │       │  Redis               │
│  users · watchlist  │       │  quote cache (60s)   │
│  alerts · news      │       │  profile cache (6h)  │
│  signals · portfolio│       │  rate limiter state  │
│  pushSubscriptions  │       └─────────────────────┘
└─────────────────────┘

External APIs
  Finnhub REST  — live quotes, company profiles, news, screener
  RSS feeds     — Reuters, CNBC, MarketWatch (4× daily)
  Google OAuth  — authentication
  Web Push      — VAPID push notification delivery
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
