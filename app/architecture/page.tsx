import Link from "next/link";
import ArchitectureProgress from "@/components/ui/ArchitectureProgress";
import ExpandableCard from "@/components/ui/ExpandableCard";

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

// ── Source link ───────────────────────────────────────────────────────────────

function Src({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-mono text-text-muted italic">{children}</span>
  );
}

function Def({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-3 space-y-1" style={{ background: "rgba(5,13,26,0.5)", border: "1px solid rgba(247,243,229,0.07)" }}>
      <p className="text-[11px] font-mono font-semibold text-gold-500 uppercase tracking-wide">{term}</p>
      <p className="text-xs text-text-secondary leading-relaxed">{children}</p>
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

        {/* Cards */}
        <div className="flex flex-col gap-5 stagger-children">

          {/* Priority Queue */}
          <ExpandableCard
            id="arch-queue"
            icon={<IconZap />}
            title="Priority Queue & Rate Limiting"
            accent="linear-gradient(90deg, rgba(251,191,36,0.5), rgba(251,191,36,0.05) 70%, transparent)"
            summary={<>
              <p>Finnhub free tier caps at <Pill>60 req/min</Pill>. With 50+ watchlist tickers each needing a fresh quote every 60s, naive round-robin wastes the budget on low-priority tickers while high-volatility ones go stale.</p>
              <p>Solution: a <strong className="text-text-primary">float-score priority queue</strong>. Each ticker is scored by recency, watchlist count, and pending alert rules. The token bucket refills at 55 tokens/min — 5 held in reserve for on-demand user calls.</p>
              <p className="text-xs font-mono rounded-lg p-3" style={{ background: "rgba(5,13,26,0.6)", border: "1px solid rgba(247,243,229,0.07)" }}>
                score = (staleness_weight × Δt) + (watchlist_count × 0.4) + (alert_rules × 0.3)
              </p>
            </>}
            detail={<>
              <Def term="Token Bucket Algorithm">
                A rate-limiting technique where a counter (the &ldquo;bucket&rdquo;) fills at a fixed rate up to a maximum capacity. Each API call consumes one token. If the bucket is empty, the call waits. Unlike a fixed window counter, the token bucket smooths bursts — unused capacity carries forward.
              </Def>
              <Def term="Priority Queue (Max-Heap)">
                A data structure where the highest-scored element is always extracted first. Insert and extract are O(log n). Acrue uses a float score so tickers can be continuously rescored without rebuilding the entire structure.
              </Def>
              <p>Why 55 and not 60? Five tokens are reserved for synchronous user-triggered requests (search autocomplete, manual watchlist adds). Without the reserve, a burst of user activity could temporarily starve the background queue and cause quote staleness spikes.</p>
              <p>The scoring formula weights staleness most heavily: a ticker not refreshed for 59s gets a much higher score than one refreshed 5s ago, regardless of watchlist count — ensuring no ticker ever misses its 60s TTL window under normal load.</p>
              <Src>Reference: Finnhub API rate limit docs — finnhub.io/docs/api/rate-limit</Src>
            </>}
          />

          {/* Ticker Scheduler */}
          <ExpandableCard
            id="arch-scheduler"
            icon={<IconActivity />}
            title="Ticker Scheduler — Distributed Work Queue"
            accent="linear-gradient(90deg, rgba(34,197,94,0.4), rgba(34,197,94,0.05) 70%, transparent)"
            summary={<>
              <p>The scheduler runs as a <strong className="text-text-primary">two-timer background loop</strong> inside the Next.js process — no separate worker service needed.</p>
              <ul className="space-y-1.5 list-none">
                <li><Pill>60s rebuild</Pill> Rescores all tickers, adds new watchlist entries, removes delisted ones.</li>
                <li><Pill>~1091ms drain</Pill> Pops the top-scored ticker, fetches a fresh quote, writes to Redis, fires alert detection. 1091ms × 55 = 60,005ms — exactly fills the rate budget per minute.</li>
              </ul>
            </>}
            detail={<>
              <Def term="Work Queue Pattern">
                Producers enqueue tasks; one or more workers dequeue and process them. Canonical implementations: AWS SQS, Redis-backed BullMQ, Celery. In Acrue the &ldquo;tasks&rdquo; are ticker IDs, the &ldquo;queue&rdquo; is an in-memory sorted set, and the &ldquo;worker&rdquo; is the drain timer — all colocated in one Node.js process.
              </Def>
              <p>Why 1091ms and not 1000ms (1s)? At exactly 1000ms × 60 calls = 60,000ms, there is zero margin for drift — any scheduling jitter causes a rate limit violation. 1091ms × 55 = 60,005ms, spending 5ms of headroom per minute. The 5-token reserve adds a second safety layer.</p>
              <p>The two-timer split matters: rebuilding the queue on every drain tick (every 1.09s) would mean 55 full DB reads per minute. The 60s rebuild batches that cost to once per minute while the drain loop stays lightweight — just a heap pop and a single Finnhub call.</p>
              <p>The <code className="text-gold-500">afterFetchListener</code> callback fires synchronously after each successful quote write to Redis, passing the fresh quote directly to alert detection — no second cache read needed.</p>
              <Src>Reference: BullMQ docs — docs.bullmq.io | AWS SQS concepts — docs.aws.amazon.com/AWSSimpleQueueService</Src>
            </>}
          />

          {/* Search Autocomplete */}
          <ExpandableCard
            id="arch-search"
            icon={<IconSearch />}
            title="Search Autocomplete & Recommender"
            accent="linear-gradient(90deg, rgba(147,197,253,0.4), rgba(147,197,253,0.05) 70%, transparent)"
            summary={<>
              <p>The autocomplete layer calls Finnhub <code className="text-gold-500">/search</code>, then re-ranks candidates using a <strong className="text-text-primary">tag-based recommender</strong> before returning results.</p>
              <ul className="space-y-1 list-none text-xs">
                <li>→ Sector match with current watchlist tickers (+score)</li>
                <li>→ Industry match (+score)</li>
                <li>→ Same exchange as existing holdings (+score)</li>
                <li>→ Common stock preferred over ADR / ETF / preferred shares</li>
              </ul>
              <p>Results capped at 10, sorted by composite score. No vector DB, no ML model — pure deterministic re-ranking.</p>
            </>}
            detail={<>
              <Def term="Tag-Based Recommender">
                A content-based filtering approach that scores candidates by overlap with a user profile built from explicit tags (sector, industry, exchange). Unlike collaborative filtering (what similar users searched for) or embedding similarity (vector distance), tag-based scoring is fully deterministic, zero-latency, and interpretable.
              </Def>
              <p>Finnhub <code className="text-gold-500">/search</code> returns up to 15 results sorted by exchange relevance, not by fit to the user&apos;s existing watchlist. The raw results frequently include ADRs, preferred share classes (e.g. BRK.B listed alongside BRK.A), and tickers from exchanges the user doesn&apos;t track — noise the re-ranker filters out.</p>
              <p>Search results are cached at 1h TTL in Redis. The re-ranking score is computed at query time (not cached) because the user&apos;s watchlist composition changes between calls — a ticker&apos;s relevance depends on what the user already holds.</p>
              <Src>Reference: Finnhub symbol search — finnhub.io/docs/api/symbol-search</Src>
            </>}
          />

          {/* Alert Detection */}
          <ExpandableCard
            id="arch-alerts"
            icon={<IconBell />}
            title="Alert Detection"
            accent="linear-gradient(90deg, rgba(239,68,68,0.4), rgba(239,68,68,0.05) 70%, transparent)"
            summary={<>
              <p>Alert detection runs on every quote fetch via <code className="text-gold-500">afterFetchListener</code> — up to 55 checks/minute, always on freshly cached data, with no separate polling loop.</p>
              <p>Originally designed on OHLCV candles (RSI, EMA cross). Finnhub free tier returns <Pill color="#dc2626">403</Pill> on <code className="text-gold-500">/stock/candle</code> — rewrote detection to use <code className="text-gold-500">quote.changePct</code> and intraday range <code className="text-gold-500">(dayHigh − dayLow) / prevClose</code> only.</p>
              <p>Per-rule cooldowns in Redis prevent alert spam after a threshold is breached.</p>
            </>}
            detail={<>
              <Def term="RSI (Relative Strength Index)">
                A momentum oscillator measuring the speed and magnitude of recent price changes on a scale of 0–100. Readings above 70 indicate overbought conditions; below 30 indicates oversold. Requires a rolling window of closing prices — typically 14 periods — which Acrue cannot compute without candle history.
              </Def>
              <Def term="EMA Cross (Exponential Moving Average Crossover)">
                A signal generated when a short-period EMA (e.g. 9-day) crosses above or below a long-period EMA (e.g. 21-day), indicating a potential trend change. Also requires historical OHLCV data.
              </Def>
              <p>The candle endpoint block was discovered after shipping the initial alert detection service. The fix required removing all indicator-based detection types and rebuilding around the fields available in a single <code className="text-gold-500">/quote</code> response: <code className="text-gold-500">c</code> (current), <code className="text-gold-500">pc</code> (prev close), <code className="text-gold-500">h</code> (day high), <code className="text-gold-500">l</code> (day low). This covers price change %, intraday volatility range, and high/low breaches — enough for meaningful alerts without history.</p>
              <p>Cooldown keys are Redis strings with TTL equal to the cooldown period. When an alert fires, the key is set; subsequent detection skips the ticker+rule pair until the key expires. This is O(1) per check and survives process restarts (unlike an in-memory Set).</p>
              <Src>Reference: Finnhub quote fields — finnhub.io/docs/api/quote | RSI definition — Wilder (1978) &ldquo;New Concepts in Technical Trading Systems&rdquo;</Src>
            </>}
          />

          {/* News Pipeline */}
          <ExpandableCard
            id="arch-news"
            icon={<IconNewspaper />}
            title="News Pipeline & NLP"
            accent="linear-gradient(90deg, rgba(168,85,247,0.4), rgba(168,85,247,0.05) 70%, transparent)"
            summary={<>
              <p>Macro news from 5 RSS feeds (Reuters, CNBC, MarketWatch, Yahoo Finance, Seeking Alpha) — free, no API key, ingested 4× daily. Company news from Finnhub <code className="text-gold-500">/company-news</code> — no extra quota consumed.</p>
              <p>Sentiment scored with AFINN lexicon, normalised to <code className="text-gold-500">[0, 1]</code> by dividing raw sum by <code className="text-gold-500">wordCount × 5</code> to remove article-length bias.</p>
              <p>Ticker extraction uses word-boundary regex with a 2-char minimum — single-letter tickers (F, S, M) produce false positives in every financial sentence.</p>
            </>}
            detail={<>
              <Def term="AFINN Sentiment Lexicon">
                A manually rated word list of ~3,300 English words scored from −5 (most negative) to +5 (most positive), developed by Finn Årup Nielsen (2011). Designed for short-form social media text but widely applied to financial news. Fast and dependency-free — no model inference, no API call.
              </Def>
              <Def term="Sentiment Normalisation">
                Raw AFINN sum grows proportionally with article length (more words = more scored terms). Dividing by <code className="font-mono text-gold-500">wordCount × 5</code> (the theoretical max score per word) yields a length-independent score in [−1, 1]. Acrue maps this to [0, 1] before storage: <code className="font-mono text-gold-500">stored = (raw / (wordCount × 5) + 1) / 2</code>.
              </Def>
              <p>The 4× daily RSS schedule aligns with market events: pre-market (6:00), market open (9:30), midday (12:30), close (16:00) ET. An immediate startup ingest ensures the news feed is populated from the first boot — without it, scheduled cron times could leave the feed empty for hours on a fresh deploy.</p>
              <p>The trusted-sources allowlist for Finnhub company news filters out the hundreds of low-quality blogs Finnhub aggregates. Only tier-1 outlets (Reuters, AP, Bloomberg, WSJ, FT, etc.) are stored. This materially reduces NLP noise and keeps sentiment scores meaningful.</p>
              <Src>Reference: Nielsen (2011) &ldquo;A new ANEW: Evaluation of a word list for sentiment analysis in microblogs&rdquo; — arxiv.org/abs/1103.2903</Src>
            </>}
          />

          {/* Signal Scoring */}
          <ExpandableCard
            id="arch-signals"
            icon={<IconTrendingUp />}
            title="Signal Scoring"
            accent="linear-gradient(90deg, rgba(52,211,153,0.4), rgba(52,211,153,0.05) 70%, transparent)"
            summary={<>
              <p>Composite score from four components, each normalised to [0, 100]:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                {[
                  { label: "Momentum", weight: "35%", color: "#22c55e" },
                  { label: "Analyst",  weight: "25%", color: "#3b82f6" },
                  { label: "Valuation",weight: "20%", color: "#f59e0b" },
                  { label: "News NLP", weight: "20%", color: "#a855f7" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg p-2.5" style={{ background: "rgba(5,13,26,0.6)", border: "1px solid rgba(247,243,229,0.07)" }}>
                    <div className="text-[10px] text-text-muted mb-0.5">{s.label}</div>
                    <div className="font-bold" style={{ color: s.color }}>{s.weight}</div>
                  </div>
                ))}
              </div>
              <p>No candle history required — 52-week high/low used as annual volatility proxy; PEG derived from analyst price target upside.</p>
            </>}
            detail={<>
              <Def term="Momentum Score (35%)">
                Combines intraday change % (quote.changePct) and 52-week range position: <code className="font-mono text-gold-500">(price − low52w) / (high52w − low52w)</code>. A ticker near its 52-week high with a positive daily change scores highest. Weighted most heavily because short-term edge is Acrue&apos;s primary value proposition.
              </Def>
              <Def term="Analyst Score (25%)">
                Consensus buy/hold/sell rating from Finnhub <code className="font-mono text-gold-500">/recommendation-trends</code> mapped to [0, 1], combined with analyst price target upside: <code className="font-mono text-gold-500">(targetPrice − currentPrice) / currentPrice</code>. Sell-side signal adds institutional perspective alongside quantitative momentum.
              </Def>
              <Def term="Valuation Score (20%)">
                P/E ratio vs sector median (penalises expensive growth) combined with a PEG proxy: analyst target upside treated as 1-year forward implied growth. No EPS growth estimate endpoint exists on Finnhub free tier — target upside is a serviceable approximation for a composite score where valuation is a 20% weight.
              </Def>
              <Def term="52-week Range as Volatility Proxy">
                Annual σ ≈ range / (2 × 1.96 × price). Assumes prices are approximately normally distributed within a 95% confidence interval defined by the 52-week high/low. This is a rough proxy — actual σ from daily returns would be more accurate — but requires no historical price data and is directionally correct for most equities.
              </Def>
              <Src>Reference: Finnhub basic financials — finnhub.io/docs/api/company-basic-financials | Finnhub recommendation trends — finnhub.io/docs/api/recommendation-trends</Src>
            </>}
          />

          {/* Portfolio MPT */}
          <ExpandableCard
            id="arch-portfolio"
            icon={<IconPieChart />}
            title="Portfolio Optimization — MPT"
            accent="linear-gradient(90deg, rgba(251,191,36,0.4), rgba(251,191,36,0.05) 70%, transparent)"
            summary={<>
              <p>Standard closed-form MVO (mean-variance optimisation) requires inverting the covariance matrix — which is singular when fewer than ~30 price observations exist per ticker. Acrue uses <strong className="text-text-primary">projected gradient ascent</strong> on a utility function instead:</p>
              <p className="text-xs font-mono rounded-lg p-3" style={{ background: "rgba(5,13,26,0.6)", border: "1px solid rgba(247,243,229,0.07)" }}>
                U = μ − A·σ²{"  "}(maximise)<br />
                <span className="text-text-muted">subject to: weights ∈ Δⁿ (simplex) via Duchi 2008</span>
              </p>
              <p>Duchi simplex projection keeps weights ≥ 0 and summing to 1 after every gradient step — O(n log n), stable for any portfolio size.</p>
            </>}
            detail={<>
              <Def term="Modern Portfolio Theory (Markowitz 1952)">
                Framework for constructing portfolios that maximise expected return for a given level of risk (σ²). The efficient frontier defines the set of optimal portfolios. The closed-form solution is w* = (1/2A) Σ⁻¹ μ — requires inverting the covariance matrix Σ, which fails when Σ is singular (linearly dependent columns).
              </Def>
              <Def term="Utility Function U = μ − A·σ²">
                A risk-adjusted return measure where μ is expected portfolio return, σ² is portfolio variance, and A is the risk aversion coefficient (user-configurable, default A=3). Maximising U trades off return against risk — higher A produces more conservative allocations.
              </Def>
              <Def term="Duchi Simplex Projection (2008)">
                An O(n log n) algorithm that projects an arbitrary vector onto the probability simplex — the set where all elements are ≥ 0 and sum to 1. Applied after each gradient step to enforce the portfolio weight constraints. Sort, compute cumulative sums, find the threshold, apply max(0, x−θ). No matrix inversion involved.
              </Def>
              <p>Expected returns μ are estimated from the signal score for each ticker, normalised to a daily return equivalent. Covariance matrix Σ uses 30-day log returns from daily closing prices fetched via the Yahoo Finance historical endpoint (not blocked on free tier unlike Finnhub candles).</p>
              <Src>Reference: Markowitz (1952) &ldquo;Portfolio Selection&rdquo; — Journal of Finance | Duchi et al. (2008) &ldquo;Efficient Projections onto the ℓ₁-Ball&rdquo; — ICML 2008</Src>
            </>}
          />

          {/* WebSocket */}
          <ExpandableCard
            id="arch-websocket"
            icon={<IconWifi />}
            title="WebSocket Server"
            accent="linear-gradient(90deg, rgba(6,182,212,0.4), rgba(6,182,212,0.05) 70%, transparent)"
            summary={<>
              <p>Default Next.js <code className="text-gold-500">{"{ server }"}</code> mode intercepts <em>all</em> WebSocket upgrades — including <code className="text-gold-500">/_next/webpack-hmr</code>, breaking hot reload in development.</p>
              <p>Solution: <Pill>noServer: true</Pill> — manually route upgrade events so only <code className="text-gold-500">/ws</code> goes to the WS server; all other paths pass to Next.js.</p>
              <p>Auth decodes the next-auth JWT cookie directly on the upgrade request — no extra HTTP round-trip. Falls back to 60s polling on Vercel (serverless, no persistent process).</p>
            </>}
            detail={<>
              <Def term="WebSocket Upgrade Handshake">
                WebSocket connections start as HTTP requests with an <code className="font-mono text-gold-500">Upgrade: websocket</code> header. The server responds with HTTP 101 Switching Protocols. After that, the TCP connection is repurposed for full-duplex frames. The <code className="font-mono text-gold-500">upgrade</code> event on Node&apos;s <code className="font-mono text-gold-500">http.Server</code> is fired for every upgrade request — not just <code className="font-mono text-gold-500">/ws</code>.
              </Def>
              <Def term="noServer Mode (ws library)">
                When <code className="font-mono text-gold-500">noServer: true</code>, the <code className="font-mono text-gold-500">ws.WebSocketServer</code> doesn&apos;t bind to any HTTP server itself. Instead, you call <code className="font-mono text-gold-500">wss.handleUpgrade(req, socket, head, cb)</code> manually on requests you choose to route there. This gives full control over which paths become WebSocket connections.
              </Def>
              <Def term="JWE Cookie Auth on Upgrade">
                Next-auth v5 stores the session as a JWE (JSON Web Encryption) cookie. The <code className="font-mono text-gold-500">decode()</code> function from <code className="font-mono text-gold-500">@auth/core/jwt</code> decrypts it using <code className="font-mono text-gold-500">AUTH_SECRET</code> as the key. Since cookies are included in the HTTP upgrade request headers, the session is available without any additional HTTP call.
              </Def>
              <p>Dynamic <code className="text-gold-500">import()</code> is used for the ws and push modules inside the <code className="text-gold-500">afterFetchListener</code> callback to avoid circular dependencies: <code className="text-gold-500">notifications → ws → notifications</code>. Dynamic import resolves at call time, breaking the cycle.</p>
              <Src>Reference: ws library docs — github.com/websockets/ws | Next-auth JWT — authjs.dev/reference/core/jwt</Src>
            </>}
          />

          {/* Database */}
          <ExpandableCard
            id="arch-database"
            icon={<IconDatabase />}
            title="Database Design"
            accent="linear-gradient(90deg, rgba(99,102,241,0.4), rgba(99,102,241,0.05) 70%, transparent)"
            summary={<>
              <p>PostgreSQL via Prisma ORM. UUID primary keys throughout. Key schema decisions:</p>
              <ul className="space-y-1.5 list-none text-xs">
                <li><Pill>assets</Pill> Populated lazily on watchlist add — no bulk import. Profile fetched from Finnhub on first add.</li>
                <li><Pill>alertRules</Pill> Separate table (not JSONB) — enables per-user per-ticker customisation and cooldown queries.</li>
                <li><Pill>UserNewsRead</Pill> Compound PK join table — persistent per-user read state with cascade delete.</li>
                <li><Pill>simPortfolios</Pill> <code className="text-gold-500">startPrice</code> locked at add time; live P&amp;L computed from Redis quote cache.</li>
              </ul>
            </>}
            detail={<>
              <Def term="UUID Primary Keys">
                Universally Unique Identifiers (RFC 4122) as PKs prevent sequential ID enumeration (an attacker can&apos;t guess adjacent record IDs), work across distributed inserts without coordination, and are safe to expose in URLs. The trade-off: UUIDs are 16 bytes vs 4 bytes for a 32-bit int — slightly larger indexes, but negligible at this scale.
              </Def>
              <Def term="Lazy Asset Population">
                Instead of running a bulk import job to pre-populate the assets table with all ~8,000 US equities, Acrue fetches and inserts the asset profile from Finnhub only when a user first adds a ticker to their watchlist. This eliminates a complex ETL job, keeps the table lean, and ensures profiles are always current (fetched on demand, cached at 6h TTL).
              </Def>
              <Def term="alertRules as a Separate Table">
                Storing rules as a JSONB column inside the alerts table would make per-rule cooldown queries expensive (requires a JSON path scan). A separate <code className="font-mono text-gold-500">alertRules</code> table with indexed <code className="font-mono text-gold-500">(userId, ticker)</code> allows O(1) rule lookup and clean foreign key constraints. It also enables future UI features like rule history and per-rule analytics.
              </Def>
              <p>The <code className="text-gold-500">UserNewsRead</code> compound PK <code className="text-gold-500">(userId, articleId)</code> means read state is checked with a single indexed lookup rather than a full table scan. Cascade delete ensures user deletion removes all associated read records automatically, satisfying GDPR-style data removal without manual cleanup logic.</p>
              <Src>Reference: Prisma schema docs — prisma.io/docs/orm/prisma-schema | PostgreSQL UUID type — postgresql.org/docs/current/datatype-uuid.html</Src>
            </>}
          />

          {/* Frontend Architecture */}
          <ExpandableCard
            id="arch-frontend"
            icon={<IconLayers />}
            title="Frontend Architecture"
            accent="linear-gradient(90deg, rgba(244,114,182,0.4), rgba(244,114,182,0.05) 70%, transparent)"
            summary={<>
              <p>Three strictly separated layers:</p>
              <ul className="space-y-1.5 list-none text-xs">
                <li><Pill>app/(pages)/*/page.tsx</Pill> Layout only — compose stateful components, no business logic.</li>
                <li><Pill>components/stateful/</Pill> Own data fetching and local state. Each maps to one use case.</li>
                <li><Pill>components/ui/</Pill> Stateless presentational — props only, no fetch, no side effects.</li>
              </ul>
              <p>Dashboard fetches 4 endpoints in parallel with <code className="text-gold-500">Promise.allSettled</code>. WebSocket updates patch local state directly — no refetch on every price tick.</p>
            </>}
            detail={<>
              <Def term="Promise.allSettled vs Promise.all">
                <code className="font-mono text-gold-500">Promise.all</code> rejects as soon as any promise rejects — one slow or failed endpoint blanks the entire dashboard. <code className="font-mono text-gold-500">Promise.allSettled</code> always resolves with an array of outcomes, letting each quadrant (alerts, signals, movers, news) render independently with its own data or error state.
              </Def>
              <Def term="Stateful vs UI Component Split">
                Stateful components own their data lifecycle — they call APIs, manage loading/error states, and subscribe to WebSocket events. UI components are pure functions of their props — no hooks beyond display logic. This split makes UI components trivially testable (pass props, assert output) and reusable across different data sources without modification.
              </Def>
              <p>WebSocket message handling uses <code className="text-gold-500">useCallback</code> with a stable reference to avoid re-registering the WS listener on every render. Quote updates patch only the affected ticker in watchlist state via a <code className="text-gold-500">map()</code> over the existing array — O(n) but n is at most ~50 watchlist items, well within render budget.</p>
              <p>The glassmorphism effect on dashboard cards uses a CSS <code className="text-gold-500">spotlight</code> class with <code className="text-gold-500">--mx</code>/<code className="text-gold-500">--my</code> CSS variables updated via <code className="text-gold-500">onMouseMove</code>. The radial gradient follows the cursor position, creating a dynamic light source effect without a canvas or WebGL dependency.</p>
              <Src>Reference: React docs — react.dev/reference/react/Promise | Next.js App Router — nextjs.org/docs/app</Src>
            </>}
          />

          {/* Deployment */}
          <ExpandableCard
            id="arch-deployment"
            icon={<IconServer />}
            title="Deployment"
            accent="linear-gradient(90deg, rgba(251,146,60,0.4), rgba(251,146,60,0.05) 70%, transparent)"
            summary={<>
              <p>Vercel (serverless) for the Next.js app. PostgreSQL and Redis on Railway (persistent Node processes). WebSocket server requires a persistent process — falls back to 60s polling on Vercel automatically.</p>
              <p><Pill>postinstall</Pill> runs <code className="text-gold-500">prisma generate</code> before <code className="text-gold-500">next build</code> on every deploy. <code className="text-gold-500">tsx</code> in <code className="text-gold-500">dependencies</code> (not devDependencies) — Railway&apos;s production install skips dev deps.</p>
            </>}
            detail={<>
              <Def term="Serverless vs Persistent Process">
                Vercel functions spin up on-demand, handle one request, then terminate. There is no persistent memory, no long-running timer, and no TCP socket that survives between requests. This makes the tickerScheduler background loop and WebSocket server incompatible with Vercel — both require a process that stays alive continuously.
              </Def>
              <Def term="Vercel + Railway Split">
                Vercel handles the stateless Next.js frontend and API routes (perfect fit for serverless). Railway runs the persistent Node WebSocket server and managed infrastructure (PostgreSQL, Redis). The trade-off: two platforms to manage, but each optimised for its workload. Railway&apos;s persistent Node process could also host the entire app if Vercel&apos;s serverless limitation becomes blocking.
              </Def>
              <p>The <code className="text-gold-500">postinstall</code> script in <code className="text-gold-500">package.json</code> ensures <code className="text-gold-500">prisma generate</code> runs after every <code className="text-gold-500">npm install</code> — on developer machines, in CI, and on deploy platforms. Without it, the Prisma client (a generated JS file in <code className="text-gold-500">node_modules/.prisma/client</code>) may be absent or stale, causing runtime errors before the app starts.</p>
              <p>The 60s polling fallback in frontend components means the app degrades gracefully on Vercel — users see quote updates at most 60s late instead of real-time, but all functionality remains intact. The <code className="text-gold-500">useWebSocket</code> hook detects connection failure and switches to the polling path automatically.</p>
              <Src>Reference: Vercel serverless limits — vercel.com/docs/functions/limitations | Railway docs — docs.railway.app</Src>
            </>}
          />

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
