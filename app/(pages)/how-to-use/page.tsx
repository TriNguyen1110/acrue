export default function HowToUsePage() {
  const sections = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: "⊞",
      summary:
        "Your command center. On load, four quadrants populate in parallel: unread alerts, top-scored signals, biggest movers on your watchlist, and the latest financial news. Each quadrant is independent — if one data source is slow, the others still render.",
    },
    {
      href: "/watchlist",
      label: "Watchlist",
      icon: "★",
      summary:
        "Search for any ticker and add it to your personal watchlist. Live quotes stream via WebSocket and update up to once per minute. The screener surfaces the day's biggest gainers, losers, and most-active names from the S&P 100 so you can discover new tickers at a glance.",
    },
    {
      href: "/alerts",
      label: "Alerts",
      icon: "⚑",
      summary:
        "Define rules per ticker: price change threshold, RSI bounds, volume spike multiplier, or EMA crossover. Detection runs continuously against live quote data. When a rule fires, an alert is created and pushed to you instantly via WebSocket (in-app) and optionally via browser push notification (even with the tab closed). Use the filter panel to narrow by type, severity, ticker, sector, industry, and cap tier.",
    },
    {
      href: "/news",
      label: "News",
      icon: "☰",
      summary:
        "Articles are ingested from Finnhub company news and five tier-1 RSS feeds (AP Business, CNBC, MarketWatch, Yahoo Finance, Seeking Alpha) four times daily at market-aligned times. Each article is scored for sentiment using the AFINN lexicon, tagged with relevant tickers, and classified by macro topic. Filter by topic or ticker, and articles you expand sink to the bottom so unread news always floats to the top.",
    },
    {
      href: "/signals",
      label: "Signals",
      icon: "↗",
      summary:
        "A composite score (0–100) is computed for every watchlisted ticker from four components: momentum (35%), sell-side analyst rating (25%), valuation (20%), and news sentiment (20%). Scores come with a 30-day projected confidence interval derived from the ticker's 52-week range. Higher scores indicate stronger buy-side signals across all four dimensions.",
    },
    {
      href: "/portfolio",
      label: "Portfolio",
      icon: "⊕",
      summary:
        "Enter your real holdings and Acrue computes portfolio-level analytics: expected return, volatility, Sharpe ratio, and Value at Risk. Hit Optimize to run Modern Portfolio Theory optimization — a projected gradient ascent on the mean-variance utility function that finds the weight allocation maximising risk-adjusted return for your chosen risk level.",
    },
    {
      href: "/simulate",
      label: "Simulate",
      icon: "⟳",
      summary:
        "Create one or more paper trading portfolios with no real money. Add tickers at the current live price — that price is locked in as your entry. Acrue tracks P&L in real time against live market prices so you can test strategies, compare two portfolios side-by-side, and see which thesis plays out.",
    },
  ];

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <div className="mb-10 text-center">
        <h1
          className="font-display text-4xl text-gold-400 mb-3"
          style={{ textShadow: "0 0 24px rgba(247,243,229,0.35), 0 0 48px rgba(247,243,229,0.12)" }}
        >
          How to Use Acrue
        </h1>
        <p className="text-sm max-w-xl mx-auto" style={{ color: "rgba(247,243,229,0.55)" }}>
          A quick walkthrough of every feature. Each section links to the relevant page.
        </p>
      </div>

      {/* Demo video */}
      <a
        href="https://youtu.be/CGSzFK9VMNs"
        target="_blank"
        rel="noopener noreferrer"
        className="mb-10 rounded-2xl border flex flex-col items-center justify-center transition-colors hover:border-gold-400/40"
        style={{
          background: "rgba(10,22,40,0.7)",
          borderColor: "rgba(247,243,229,0.1)",
          minHeight: 280,
        }}
      >
        <span className="text-5xl mb-4" style={{ filter: "drop-shadow(0 0 12px rgba(247,243,229,0.3))" }}>
          ▶
        </span>
        <p className="font-display text-xl text-gold-400 mb-1">Watch the demo</p>
        <p className="text-sm" style={{ color: "rgba(247,243,229,0.4)" }}>
          youtu.be/CGSzFK9VMNs
        </p>
      </a>

      {/* Feature sections */}
      <div className="space-y-4">
        {sections.map(({ href, label, icon, summary }) => (
          <a
            key={href}
            href={href}
            className="block rounded-2xl border p-5 transition-all duration-200 hover:border-gold-600 hover:bg-navy-700"
            style={{
              background: "rgba(10,22,40,0.6)",
              borderColor: "rgba(247,243,229,0.08)",
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg w-6 text-center" style={{ color: "rgba(247,243,229,0.6)" }}>
                {icon}
              </span>
              <span className="font-display text-lg text-gold-400">{label}</span>
              <span
                className="ml-auto text-xs tracking-wide"
                style={{ color: "rgba(247,243,229,0.3)" }}
              >
                →
              </span>
            </div>
            <p className="text-sm leading-relaxed pl-9" style={{ color: "rgba(247,243,229,0.6)" }}>
              {summary}
            </p>
          </a>
        ))}
      </div>
    </main>
  );
}
