import Link from "next/link";
import ArchitectureProgress from "@/components/ui/ArchitectureProgress";

// ── Icon components (pure SVG, no dependencies) ───────────────────────────────

function IconLayers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

function IconDatabase() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconNewspaper() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" /><path d="M15 18h-5" /><path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

function IconTrendingUp() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function IconPieChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

function IconWifi() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0" />
      <path d="M1.42 9a16 16 0 0 1 21.16 0" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}

function IconServer() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function Card({
  id,
  icon,
  title,
  accent,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(10, 22, 40, 0.65)",
        border: "1px solid rgba(247,243,229,0.1)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(247,243,229,0.06)",
      }}
    >
      {/* Accent bar */}
      <div className="h-[2px] w-full" style={{ background: accent }} />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span style={{ color: "rgba(247,243,229,0.7)" }}>{icon}</span>
          <h2
            className="font-display text-lg text-gold-400"
            style={{ textShadow: "0 0 16px rgba(247,243,229,0.2)" }}
          >
            {title}
          </h2>
        </div>
        <div className="text-sm text-text-secondary leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-block text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full"
      style={{
        background: color ?? "rgba(247,243,229,0.08)",
        color: color ? "#fff" : "rgba(247,243,229,0.7)",
        border: "1px solid rgba(247,243,229,0.12)",
      }}
    >
      {children}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--navy-900)", color: "var(--text-primary)" }}
    >
      <ArchitectureProgress />
      {/* Ambient background */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(247,243,229,0.06) 0%, transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-14 animate-fade-up">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="text-xs font-mono text-text-muted hover:text-gold-400 transition-colors"
            >
              ← Back to Acrue
            </Link>
            <Link
              href="/login"
              className="btn-gold text-xs font-mono px-3 py-1.5 rounded-full"
              style={{
                background: "linear-gradient(135deg, #ede4cc, #f7f3e5)",
                color: "#0a1628",
                fontWeight: 600,
                boxShadow: "0 0 16px rgba(247,243,229,0.25)",
              }}
            >
              Sign in →
            </Link>
          </div>

          <div className="text-center">
            <p className="text-xs font-mono tracking-[0.25em] uppercase text-text-muted mb-3">
              Engineering Deep-Dive
            </p>
            <h1
              className="font-display text-5xl md:text-6xl text-gold-400 mb-4"
            >
              Architecture
            </h1>
            <p className="text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">
              How Acrue is built — rate limiting, distributed scheduling, NLP pipelines,
              portfolio optimization, and real-time delivery. Every tradeoff documented.
            </p>
          </div>
        </div>

        {/* System architecture diagram */}
        <div
          id="arch-overview"
          className="rounded-2xl mb-10 overflow-hidden animate-fade-up-1"
          style={{
            background: "rgba(10,22,40,0.7)",
            border: "1px solid rgba(247,243,229,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(247,243,229,0.06)",
          }}
        >
          <div className="h-[2px]" style={{ background: "linear-gradient(90deg, rgba(247,243,229,0.4), rgba(247,243,229,0.05) 70%, transparent)" }} />
          <div className="p-8">
            <h2 className="font-display text-xl text-gold-400 mb-6 text-center" style={{ textShadow: "0 0 16px rgba(247,243,229,0.2)" }}>
              System Overview
            </h2>
            <div className="font-mono text-xs leading-relaxed overflow-x-auto">
              <pre
                style={{
                  color: "rgba(247,243,229,0.75)",
                  background: "rgba(5,13,26,0.6)",
                  border: "1px solid rgba(247,243,229,0.08)",
                  borderRadius: 12,
                  padding: "24px 28px",
                  lineHeight: 1.8,
                }}
              >{`Browser / Client
        │
        ├── REST (fetch)  ──────────────────────────────────────────────────┐
        │                                                                   │
        └── WebSocket (/ws)  ─────────────────────────────────────────────┐ │
                                                                          │ │
                            Next.js App (single process)                  │ │
┌─────────────────────────────────────────────────────────────────────┐  │ │
│                                                                     │  │ │
│  app/api/v1/*  (thin controllers — validate → call service → JSON) ◄───┘ │
│         │                                                           │    │
│         ▼                                                           │    │
│  services/  (business logic)                                        │    │
│    ├── auth.ts          JWT + bcrypt                                │    │
│    ├── marketData.ts    quotes, candles, profiles                   │    │
│    ├── alerts.ts        anomaly detection on live quotes            │    │
│    ├── news.ts          RSS ingest + AFINN sentiment                │    │
│    ├── signals.ts       composite score (momentum/analyst/NLP)      │    │
│    ├── portfolio.ts     MPT gradient ascent on U=μ−Aσ²             │    │
│    ├── simulate.ts      paper trading, live P&L                     │    │
│    ├── notifications.ts alert detection wiring + push (VAPID)       │    │
│    └── ws.ts            WebSocket broadcast ◄───────────────────────────┘
│         │                                                           │
│         ▼                                                           │
│  lib/  (infrastructure)                                             │
│    ├── db.ts            Prisma → PostgreSQL                         │
│    ├── cache.ts         ioredis → Redis                             │
│    ├── rateLimiter.ts   token bucket (55 req/min)                   │
│    └── finnhub/         quote, chart, search, summary, screener     │
│         │                                                           │
│         ▼                                                           │
│  tickerScheduler.ts  (two-timer background loop)                    │
│    ├── 60s  → rebuild priority queue (score all tickers)            │
│    └── ~1091ms → drain: pop ticker, fetch quote, cache, detect      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
         │                          │                    │
         ▼                          ▼                    ▼
    PostgreSQL                    Redis              Finnhub REST
  (persistent state)          (quote cache,        (60 req/min free)
                              rate limiter)

External feeds:
  RSS (Reuters, CNBC, MarketWatch, Yahoo Finance, Seeking Alpha) → news.ts
  Web Push VAPID → service worker → browser (high-severity alerts only)`}
              </pre>
            </div>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 stagger-children">

          {/* Priority Queue */}
          <Card
            id="arch-queue"
            icon={<IconZap />}
            title="Priority Queue & Rate Limiting"
            accent="linear-gradient(90deg, rgba(251,191,36,0.5), rgba(251,191,36,0.05) 70%, transparent)"
          >
            <p>
              Finnhub free tier caps at <Pill>60 req/min</Pill>. Every watchlist ticker needs a fresh
              quote every 60 seconds — naive round-robin wastes budget on stale tickers.
            </p>
            <p>
              Solution: a <strong className="text-text-primary">float-score priority queue</strong>. Each ticker gets a score
              based on recency, watchlist count, and pending alert rules. Higher-score tickers are drained
              first. The token bucket refills at 55 tokens/min (5 held in reserve for user-triggered calls).
            </p>
            <p className="text-xs font-mono rounded-lg p-3" style={{ background: "rgba(5,13,26,0.6)", border: "1px solid rgba(247,243,229,0.07)" }}>
              score = (staleness_weight × Δt) + (watchlist_count × 0.4) + (alert_rules × 0.3)
            </p>
          </Card>

          {/* Ticker Scheduler */}
          <Card
            id="arch-scheduler"
            icon={<IconActivity />}
            title="Ticker Scheduler — Work Queue"
            accent="linear-gradient(90deg, rgba(34,197,94,0.4), rgba(34,197,94,0.05) 70%, transparent)"
          >
            <p>
              The scheduler runs as a <strong className="text-text-primary">two-timer background loop</strong> inside the
              Next.js process — no separate worker service needed.
            </p>
            <ul className="space-y-1.5 list-none">
              <li><Pill>60s timer</Pill> Rebuilds the priority queue — rescores all tickers, adds new watchlist entries, removes delisted ones.</li>
              <li><Pill>~1091ms drain</Pill> Pops the highest-score ticker, fetches a fresh quote, writes to Redis, triggers alert detection. 1091ms × 55 ≈ 60,005ms — exactly fills the rate budget.</li>
            </ul>
            <p>This mirrors a distributed work queue (like SQS or BullMQ) but colocated — the queue is an in-memory sorted set and the worker is the drain loop.</p>
          </Card>

          {/* Search autocomplete */}
          <Card
            id="arch-search"
            icon={<IconSearch />}
            title="Search Autocomplete & Recommender"
            accent="linear-gradient(90deg, rgba(147,197,253,0.4), rgba(147,197,253,0.05) 70%, transparent)"
          >
            <p>
              Stock search needs to feel instant. The autocomplete layer calls Finnhub <code className="text-gold-500">/search</code>,
              then re-ranks candidates using a <strong className="text-text-primary">tag-based recommender</strong>:
            </p>
            <ul className="space-y-1 list-none text-xs">
              <li>→ Sector match with current watchlist tickers (+score)</li>
              <li>→ Industry match (+score)</li>
              <li>→ Same exchange as existing holdings (+score)</li>
              <li>→ Common stock preferred over ADR/ETF/preferred shares</li>
            </ul>
            <p>Results are capped at 10, sorted by composite score descending. This surfaces contextually relevant results without a vector DB or ML model — pure deterministic re-ranking.</p>
          </Card>

          {/* Alert detection */}
          <Card
            id="arch-alerts"
            icon={<IconBell />}
            title="Alert Detection"
            accent="linear-gradient(90deg, rgba(239,68,68,0.4), rgba(239,68,68,0.05) 70%, transparent)"
          >
            <p>
              Alert detection runs on every quote fetch via <code className="text-gold-500">afterFetchListener</code> — no separate polling loop.
              Detection fires up to 55 times/minute, always on freshly cached data.
            </p>
            <p>
              Originally used 5-minute OHLCV candles (RSI, EMA cross). Finnhub free tier returns <Pill color="#dc2626">403</Pill> on
              {" "}<code className="text-gold-500">/stock/candle</code>. Rewrote detection to use <code className="text-gold-500">quote.changePct</code>{" "}
              and intraday range <code className="text-gold-500">(dayHigh − dayLow) / prevClose</code> — no candle history needed.
            </p>
            <p>Per-rule cooldowns prevent alert spam. Cooldown state lives in Redis for fast read/write.</p>
          </Card>

          {/* News pipeline */}
          <Card
            id="arch-news"
            icon={<IconNewspaper />}
            title="News Pipeline & NLP"
            accent="linear-gradient(90deg, rgba(168,85,247,0.4), rgba(168,85,247,0.05) 70%, transparent)"
          >
            <p>
              Macro news from 5 RSS feeds (Reuters, CNBC, MarketWatch, Yahoo Finance, Seeking Alpha) — free, no API key, no rate cap.
              Company news from Finnhub <code className="text-gold-500">/company-news</code> — already rate-limited, no extra quota consumed.
            </p>
            <p>
              Sentiment: AFINN lexicon score normalised to <code className="text-gold-500">[0, 1]</code> by dividing by
              {" "}(<code className="text-gold-500">wordCount × 5</code>). Raw AFINN sum scales with article length — normalisation removes that bias.
            </p>
            <p>
              Ticker extraction uses word-boundary regex with a <strong className="text-text-primary">2-char minimum guard</strong> —
              single-letter tickers (F, M, S) produce false positives in every financial sentence.
            </p>
          </Card>

          {/* Signal scoring */}
          <Card
            id="arch-signals"
            icon={<IconTrendingUp />}
            title="Signal Scoring"
            accent="linear-gradient(90deg, rgba(52,211,153,0.4), rgba(52,211,153,0.05) 70%, transparent)"
          >
            <p>Composite score from four components, each normalised to [0, 100]:</p>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {[
                { label: "Momentum", weight: "35%", color: "#22c55e" },
                { label: "Analyst", weight: "25%", color: "#3b82f6" },
                { label: "Valuation", weight: "20%", color: "#f59e0b" },
                { label: "News NLP", weight: "20%", color: "#a855f7" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg p-2.5"
                  style={{ background: "rgba(5,13,26,0.6)", border: "1px solid rgba(247,243,229,0.07)" }}
                >
                  <div className="text-[10px] text-text-muted mb-0.5">{s.label}</div>
                  <div className="font-bold" style={{ color: s.color }}>{s.weight}</div>
                </div>
              ))}
            </div>
            <p>No candle history — uses 52-week high/low as annual vol proxy. PEG ratio derived from analyst price target upside as implied growth estimate.</p>
          </Card>

          {/* Portfolio optimization */}
          <Card
            id="arch-portfolio"
            icon={<IconPieChart />}
            title="Portfolio Optimization — MPT"
            accent="linear-gradient(90deg, rgba(251,191,36,0.4), rgba(251,191,36,0.05) 70%, transparent)"
          >
            <p>
              Standard closed-form MVO breaks with singular covariance matrices — common with fewer than ~10 tickers or short price history.
              Acrue uses <strong className="text-text-primary">projected gradient ascent</strong> on the utility function:
            </p>
            <p className="text-xs font-mono rounded-lg p-3" style={{ background: "rgba(5,13,26,0.6)", border: "1px solid rgba(247,243,229,0.07)" }}>
              U = μ − A·σ²<br />
              <span className="text-text-muted">subject to: weights ∈ simplex (Duchi 2008)</span>
            </p>
            <p>
              Duchi simplex projection ensures weights sum to 1 and stay ≥ 0 after each gradient step —
              a clean O(n log n) operation that handles any portfolio size without matrix inversion.
            </p>
          </Card>

          {/* WebSocket */}
          <Card
            id="arch-websocket"
            icon={<IconWifi />}
            title="WebSocket Server"
            accent="linear-gradient(90deg, rgba(6,182,212,0.4), rgba(6,182,212,0.05) 70%, transparent)"
          >
            <p>
              Default Next.js <code className="text-gold-500">&#123; server &#125;</code> mode intercepts <em>all</em> WebSocket upgrades — including
              {" "}<code className="text-gold-500">/_next/webpack-hmr</code>, which breaks hot reload.
            </p>
            <p>
              Solution: <Pill>noServer: true</Pill> with a custom <code className="text-gold-500">server.ts</code> that
              manually routes upgrade requests. Only <code className="text-gold-500">/ws</code> goes to the WS server;
              everything else passes through to Next.js unchanged.
            </p>
            <p>
              Auth on upgrade: decodes the next-auth JWT directly from request cookies using{" "}
              <code className="text-gold-500">decode()</code> from <code className="text-gold-500">@auth/core/jwt</code> — no extra HTTP round-trip.
              Deployed on Vercel (serverless), components fall back to 60s polling automatically.
            </p>
          </Card>

          {/* Database */}
          <Card
            id="arch-database"
            icon={<IconDatabase />}
            title="Database Design"
            accent="linear-gradient(90deg, rgba(99,102,241,0.4), rgba(99,102,241,0.05) 70%, transparent)"
          >
            <p>PostgreSQL via Prisma ORM. UUID primary keys throughout. Key design decisions:</p>
            <ul className="space-y-1.5 list-none text-xs">
              <li><Pill>assets</Pill> Populated lazily on watchlist add — no bulk import job. Profile fetched from Finnhub on first add.</li>
              <li><Pill>alertRules</Pill> Separate table (not JSONB) — enables per-user per-ticker customisation and cooldown queries.</li>
              <li><Pill>UserNewsRead</Pill> Compound PK join table — persistent per-user read tracking with cascade delete.</li>
              <li><Pill>simPortfolios</Pill> Paper trading: <code className="text-gold-500">startPrice</code> locked at add time, live P&L computed from quote cache.</li>
            </ul>
          </Card>

          {/* Frontend architecture */}
          <Card
            id="arch-frontend"
            icon={<IconLayers />}
            title="Frontend Architecture"
            accent="linear-gradient(90deg, rgba(244,114,182,0.4), rgba(244,114,182,0.05) 70%, transparent)"
          >
            <p>Three-layer component model:</p>
            <ul className="space-y-1.5 list-none text-xs">
              <li><Pill>app/(pages)/*/page.tsx</Pill> Layout only — compose stateful components, no logic.</li>
              <li><Pill>components/stateful/</Pill> Own data fetching and local state. Each maps to one use case.</li>
              <li><Pill>components/ui/</Pill> Stateless presentational — props only, no fetch, no side effects.</li>
            </ul>
            <p>
              Dashboard fetches 4 endpoints in parallel with <code className="text-gold-500">Promise.allSettled</code> —
              partial failures (e.g. slow signals) render the other quadrants independently rather than blanking the whole page.
            </p>
            <p>WebSocket updates patch local state directly, avoiding full refetches on quote ticks.</p>
          </Card>

          {/* Deployment */}
          <Card
            id="arch-deployment"
            icon={<IconServer />}
            title="Deployment"
            accent="linear-gradient(90deg, rgba(251,146,60,0.4), rgba(251,146,60,0.05) 70%, transparent)"
          >
            <p>
              Vercel for the Next.js frontend (serverless). Database on Railway (managed PostgreSQL).
              Redis on Railway (managed Redis). WebSocket server requires a persistent Node process —
              Vercel serverless doesn&apos;t support it, so WS falls back to 60s polling in production.
            </p>
            <p>
              <Pill>postinstall</Pill> runs <code className="text-gold-500">prisma generate</code> — ensures the Prisma client
              is generated after <code className="text-gold-500">npm install</code> on any deploy platform before
              {" "}<code className="text-gold-500">next build</code>.
            </p>
            <p>
              <code className="text-gold-500">tsx</code> moved to <code className="text-gold-500">dependencies</code> (not devDependencies) —
              Railway runs <code className="text-gold-500">npm ci --production</code> which skips devDependencies; <code className="text-gold-500">tsx</code> is needed at runtime for <code className="text-gold-500">server.ts</code>.
            </p>
          </Card>

        </div>

        {/* Tradeoffs table */}
        <div
          className="mt-10 rounded-2xl overflow-hidden animate-fade-up-4"
          style={{
            background: "rgba(10,22,40,0.65)",
            border: "1px solid rgba(247,243,229,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(247,243,229,0.06)",
          }}
        >
          <div className="h-[2px]" style={{ background: "linear-gradient(90deg, rgba(247,243,229,0.3), rgba(247,243,229,0.05) 70%, transparent)" }} />
          <div className="p-8">
            <h2 className="font-display text-xl text-gold-400 mb-6" style={{ textShadow: "0 0 16px rgba(247,243,229,0.2)" }}>
              Key Tradeoffs
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(247,243,229,0.08)" }}>
                    {["Decision", "Chosen", "Alternative", "Why"].map((h) => (
                      <th key={h} className="text-left pb-3 pr-6 text-[11px] uppercase tracking-[0.12em] text-text-muted font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  {[
                    ["Market data", "Finnhub REST", "yahoo-finance2, Polygon", "Stable API; 60 req/min free; WebSocket included"],
                    ["Rate limiting", "Token bucket + priority queue", "Simple delay loop", "Maximises data freshness within budget; watchlist tickers get priority"],
                    ["Background jobs", "In-process two-timer loop", "BullMQ, SQS", "No extra infra; single-process Node; sufficient at this scale"],
                    ["Portfolio opt.", "Gradient ascent on U=μ−Aσ²", "Closed-form MVO", "Stable for singular covariance matrices; works for any portfolio size"],
                    ["NLP", "AFINN (Node)", "OpenAI embeddings, HuggingFace", "No API cost; no latency; runs in-process; sufficient for sentiment signal"],
                    ["WebSocket auth", "Decode JWT from cookie on upgrade", "Separate HTTP auth endpoint", "Zero round-trip; session token already present in upgrade cookies"],
                    ["Read tracking", "DB join table (UserNewsRead)", "Client-side Set", "Persists across sessions; survives reload; enables analytics"],
                    ["Candle-free detection", "quote.changePct + intraday range", "OHLCV candles (RSI, EMA)", "Finnhub free tier returns 403 on /stock/candle; quote fields are free"],
                  ].map(([decision, chosen, alt, why]) => (
                    <tr
                      key={decision}
                      style={{ borderBottom: "1px solid rgba(247,243,229,0.05)" }}
                      className="transition-colors hover:bg-[rgba(247,243,229,0.02)]"
                    >
                      <td className="py-3 pr-6 text-gold-500 font-mono text-xs font-semibold whitespace-nowrap">{decision}</td>
                      <td className="py-3 pr-6 text-text-primary text-xs">{chosen}</td>
                      <td className="py-3 pr-6 text-text-muted text-xs">{alt}</td>
                      <td className="py-3 text-xs">{why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center animate-fade-up-4">
          <p className="text-text-muted text-sm mb-4">Ready to see it in action?</p>
          <Link
            href="/register"
            className="btn-gold inline-block px-8 py-3 rounded-full text-sm font-semibold"
            style={{
              background: "linear-gradient(135deg, #ede4cc, #f7f3e5)",
              color: "#0a1628",
              boxShadow: "0 0 24px rgba(247,243,229,0.3), 0 0 48px rgba(247,243,229,0.1)",
            }}
          >
            Get started with Acrue →
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t text-center" style={{ borderColor: "rgba(247,243,229,0.08)" }}>
          <span className="font-display text-xl text-gold-400" style={{ textShadow: "0 0 16px rgba(247,243,229,0.2)" }}>
            Acrue
          </span>
          <p className="text-xs text-text-muted mt-1 tracking-[0.15em] uppercase">Built to Accrue</p>
        </div>
      </div>
    </div>
  );
}
