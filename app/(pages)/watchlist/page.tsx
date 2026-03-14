import WatchlistTable from "@/components/stateful/WatchlistTable";
import { getMarketStatus } from "@/services/marketData";

export default async function WatchlistPage() {
  const market = getMarketStatus();

  return (
    <main className="px-8 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-4xl text-gold-400 mb-1">Watchlist</h1>
          <p className="text-text-secondary text-sm">Track and monitor your assets in real time.</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
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
