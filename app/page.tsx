import React from "react";
import { auth } from "@/auth";
import Link from "next/link";

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-navy-900 text-text-primary overflow-x-hidden">

      {/* ── Background radial glow ── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(247,243,229,0.07) 0%, transparent 70%)",
        }}
      />

      {/* ── Nav ── */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="575 90 910 910" width="28" height="28" style={{ filter: "drop-shadow(0 0 6px rgba(247,243,229,0.3))" }}>
            <path fill="#d8c498" d="M1036.69,2.55l-4.24-2.55-449.82,270.01v539.98l445.58,267.46,4.24,2.55,449.82-270.01V270.01L1036.69,2.55ZM1443.47,786.73l-411.03,246.72-411.03-246.72v-493.43l411.03-246.72,411.03,246.72v493.43Z"/>
            <polygon fill="#eadfc7" points="642.77 306.38 642.77 773.59 816.47 877.86 816.81 878.07 911.02 934.63 911.35 934.83 911.35 821.3 911.35 614.63 911.36 614.63 911.36 414.89 846.63 476.75 846.6 476.75 816.81 505.23 816.81 505.25 751.87 567.29 816.81 567.29 816.81 764.55 816.47 764.35 737.31 716.84 737.31 363.14 1031.96 186.28 1326.6 363.14 1326.6 716.84 1246.84 764.73 1246.84 566.58 1312.05 566.58 1247.1 504.52 1246.16 503.62 1217.32 476.04 1152.56 414.17 1152.56 476.75 1152.3 476.75 1152.3 821.49 1152.3 934.97 1152.3 935.17 1246.84 878.42 1246.84 878.22 1421.14 773.59 1421.14 306.38 1031.96 72.77 642.77 306.38"/>
            <polygon fill="#fcedcd" points="1145.07 407.02 1079.24 344.12 1079.23 344.12 1079.23 344.11 1076.5 341.49 1076.49 341.49 1032.3 299.28 988.14 341.49 988.13 341.49 984.68 344.79 984.68 344.8 919.58 407.02 984.68 407.02 984.68 865.33 984.68 978.55 1032.21 1007.06 1032.44 1007.21 1079.23 979.13 1079.23 978.83 1079.23 865.33 1079.23 458.89 1079.24 458.89 1079.24 426.91 1079.23 426.91 1079.23 407.02 1145.07 407.02"/>
          </svg>
          <span className="font-display text-2xl text-gold-400" style={{ textShadow: "0 0 16px rgba(247,243,229,0.3)" }}>
            Acrue
          </span>
        </div>
        <div className="flex items-center gap-3">
          {session ? (
            <Link
              href="/dashboard"
              className="px-5 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: "linear-gradient(135deg, #ede4cc 0%, #f7f3e5 100%)",
                color: "#050d1a",
                boxShadow: "0 0 16px rgba(247,243,229,0.35)",
              }}
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl text-sm font-medium border transition-colors hover:border-gold-400/40 hover:text-gold-400"
                style={{ borderColor: "rgba(247,243,229,0.15)", color: "rgba(247,243,229,0.6)" }}
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-5 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: "linear-gradient(135deg, #ede4cc 0%, #f7f3e5 100%)",
                  color: "#050d1a",
                  boxShadow: "0 0 16px rgba(247,243,229,0.3)",
                }}
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 text-center px-6 pt-20 pb-24 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-widest mb-8"
          style={{ borderColor: "rgba(247,243,229,0.2)", color: "rgba(247,243,229,0.5)", background: "rgba(247,243,229,0.04)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
          Live market intelligence
        </div>

        <h1
          className="font-display text-6xl md:text-7xl text-gold-400 mb-6 leading-tight"
          style={{ textShadow: "0 0 32px rgba(247,243,229,0.35), 0 0 64px rgba(247,243,229,0.12)" }}
        >
          Built to Accrue.
        </h1>

        <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          Every great portfolio starts with better information. Acrue stacks real-time quotes,
          smart alerts, news sentiment, and signal scoring into one dashboard — so your advantage
          compounds with every session.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href={session ? "/dashboard" : "/register"}
            className="px-8 py-3.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #ede4cc 0%, #f7f3e5 100%)",
              color: "#050d1a",
              boxShadow: "0 0 24px rgba(247,243,229,0.45), 0 0 56px rgba(247,243,229,0.18)",
            }}
          >
            {session ? "Go to Dashboard" : "Start for free"}
          </Link>
          {!session && (
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-xl text-sm font-medium border transition-colors hover:border-gold-400/40 hover:text-gold-400"
              style={{ borderColor: "rgba(247,243,229,0.2)", color: "rgba(247,243,229,0.6)" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border"
          style={{ borderColor: "rgba(247,243,229,0.1)", background: "rgba(247,243,229,0.06)" }}
        >
          {[
            { value: "≤55×/min",   label: "Live quote updates"    },
            { value: "4 sources",  label: "News data pipelines"   },
            { value: "Real-time",  label: "Alert detection"        },
            { value: "6 modules",  label: "Analytical features"   },
          ].map(({ value, label }) => (
            <div key={label} className="bg-navy-900 text-center py-6 px-4">
              <div className="font-display text-2xl text-gold-400 mb-1">{value}</div>
              <div className="text-[11px] uppercase tracking-widest text-text-muted">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl text-gold-400 mb-3"
            style={{ textShadow: "0 0 24px rgba(247,243,229,0.2)" }}>
            Everything you need to trade smarter
          </h2>
          <p className="text-text-secondary text-sm max-w-xl mx-auto">
            Six tightly integrated modules, built on real data — no paywalled APIs, no toy demos.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl p-6 border transition-all hover:border-gold-400/20 flex flex-col items-center text-center"
              style={{ background: "rgba(10,22,40,0.8)", borderColor: "rgba(247,243,229,0.08)" }}
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
                style={{ background: "rgba(247,243,229,0.06)", color: "rgba(247,243,229,0.7)" }}
              >
                <Icon />
              </div>
              <h3 className="font-display text-lg text-text-primary mb-2">{title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="font-display text-4xl text-gold-400 mb-3"
            style={{ textShadow: "0 0 24px rgba(247,243,229,0.2)" }}>
            How it works
          </h2>
          <p className="text-text-secondary text-sm max-w-xl mx-auto">
            From watchlist to insights in three steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              title: "Build your watchlist",
              desc: "Search and add any US stock or ETF. Acrue immediately begins streaming live quotes and scoring signals for every ticker you track.",
            },
            {
              step: "02",
              title: "Set your alert rules",
              desc: "Define thresholds for price moves, volatility, and volume spikes — per ticker. When triggered, get instant in-app alerts and browser push notifications.",
            },
            {
              step: "03",
              title: "Invest with an edge",
              desc: "Composite signal scores, news sentiment, analyst consensus, portfolio MPT optimization, and paper trading let you act with confidence.",
            },
          ].map(({ step, title, desc }) => (
            <div key={step} className="relative">
              <div
                className="text-6xl font-display mb-4 select-none"
                style={{ color: "rgba(247,243,229,0.06)" }}
              >
                {step}
              </div>
              <h3 className="font-display text-xl text-text-primary mb-2">{title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── USPs / Why Acrue ── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div
          className="rounded-2xl border p-10 md:p-14"
          style={{
            background: "rgba(10,22,40,0.8)",
            borderColor: "rgba(247,243,229,0.1)",
          }}
        >
          <h2 className="font-display text-4xl text-gold-400 mb-3 text-center"
            style={{ textShadow: "0 0 24px rgba(247,243,229,0.2)" }}>
            Why Acrue?
          </h2>
          <p className="text-text-secondary text-sm text-center mb-12 max-w-xl mx-auto">
            Professional-grade tools, without the Bloomberg price tag.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {USPS.map(({ icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-gold-400"
                  style={{ background: "rgba(247,243,229,0.07)" }}>
                  {icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">{title}</p>
                  <p className="text-sm text-text-muted leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 text-center px-6 pb-28">
        <h2 className="font-display text-5xl text-gold-400 mb-4"
          style={{ textShadow: "0 0 32px rgba(247,243,229,0.3)" }}>
          Built to accrue. Ready when you are.
        </h2>
        <p className="text-text-secondary text-sm mb-8">
          Free to use. No credit card required.
        </p>
        <Link
          href={session ? "/dashboard" : "/register"}
          className="inline-block px-10 py-4 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #ede4cc 0%, #f7f3e5 100%)",
            color: "#050d1a",
            boxShadow: "0 0 28px rgba(247,243,229,0.45), 0 0 64px rgba(247,243,229,0.18)",
          }}
        >
          {session ? "Go to Dashboard" : "Get started — it's free"}
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 border-t text-center py-6 text-[11px]"
        style={{ borderColor: "rgba(247,243,229,0.08)", color: "rgba(247,243,229,0.35)" }}
      >
        A Product By{" "}
        <a
          href="https://www.linkedin.com/in/tri-nguyen-524395253/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold-400 underline underline-offset-2 hover:text-gold-500 transition-colors"
        >
          Tri Nguyen
        </a>
      </footer>
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const FEATURES: { Icon: () => React.JSX.Element; title: string; desc: string }[] = [
  {
    Icon: () => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
      </svg>
    ),
    title: "Real-time Quote Streaming",
    desc: "WebSocket server pushes live price ticks at up to 55 updates per minute — a priority-scored scheduler ensures the most-watched and most-volatile tickers refresh first.",
  },
  {
    Icon: () => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    title: "Smart Alert Rules",
    desc: "Define per-ticker thresholds for price change, RSI, volume spikes, and EMA crossovers. High-severity alerts fire browser push notifications even with the tab closed.",
  },
  {
    Icon: () => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2" /><path d="M2 20a2 2 0 1 0 4 0V8a2 2 0 0 0-4 0v12z" /><line x1="9" y1="7" x2="18" y2="7" /><line x1="9" y1="11" x2="18" y2="11" /><line x1="9" y1="15" x2="14" y2="15" />
      </svg>
    ),
    title: "News Sentiment Analysis",
    desc: "Articles from Finnhub, Reuters, CNBC, and MarketWatch are scored with AFINN sentiment analysis, tagged to tickers and macro topics, and surfaced alongside live prices.",
  },
  {
    Icon: () => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    title: "Composite Signal Scoring",
    desc: "Each watchlist asset gets a 0–100 signal score from four weighted components: price momentum, analyst consensus, valuation (P/E + PEG), and 7-day news sentiment.",
  },
  {
    Icon: () => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /><line x1="2" y1="12" x2="22" y2="12" />
      </svg>
    ),
    title: "Portfolio Analytics & MPT",
    desc: "Track holdings P&L, Sharpe ratio, and HHI diversification. One-click MPT optimization uses projected gradient ascent to suggest ideal weightings for your risk appetite.",
  },
  {
    Icon: () => (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h20" /><path d="M5 20V8l7-6 7 6v12" /><path d="M9 20v-5h6v5" />
      </svg>
    ),
    title: "Paper Trading Simulator",
    desc: "Create multiple paper portfolios, lock in entry prices, and track live P&L against real market data — risk-free strategy testing with real price feeds.",
  },
];

const USPS = [
  {
    icon: <ZapIcon />,
    title: "No Bloomberg price tag",
    desc: "Built on Finnhub's free-tier API and public RSS feeds. Professional-grade data pipelines at zero cost.",
  },
  {
    icon: <BellIcon />,
    title: "Works while you sleep",
    desc: "Browser push notifications via Web Push (VAPID) keep you informed of high-severity market events even when the app is closed.",
  },
  {
    icon: <BrainIcon />,
    title: "Signals, not noise",
    desc: "Every alert, score, and insight is backed by real data — sentiment-scored news, analyst consensus, and volatility metrics — not gut feel.",
  },
  {
    icon: <ShieldIcon />,
    title: "Rate-limit aware by design",
    desc: "A token-bucket rate limiter with a scored priority queue maximises data freshness within the API budget — every request earns its slot.",
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

function ZapIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.14" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
