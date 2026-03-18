import WatchlistTable from "@/components/stateful/WatchlistTable";
import { getMarketStatus } from "@/services/marketData";

export default async function WatchlistPage() {
  const market = getMarketStatus();

  return (
    <main className="px-8 py-8 max-w-7xl">
      <div className="mb-8 text-center">
        <h1
          className="font-display text-4xl text-gold-400 mb-2"
          style={{ textShadow: "0 0 24px rgba(247,243,229,0.35), 0 0 48px rgba(247,243,229,0.12)" }}
        >
          Watchlist
        </h1>
        <p className="text-text-secondary text-sm max-w-xl mx-auto mb-3">
          Monitor live prices, volume, and intraday moves for every ticker on your radar. Prices refresh every 60 seconds.
        </p>
        <div className="flex items-center justify-center gap-2">
          {market.isOpen ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">Market Open</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-text-muted" />
              <span className="text-xs text-text-muted">
                Market {market.state === "PRE" ? "Pre-Market" : market.state === "POST" ? "After Hours" : "Closed"}
              </span>
            </>
          )}
        </div>
      </div>

      <WatchlistTable />
    </main>
  );
}
