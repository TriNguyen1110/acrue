import AlertsFeed from "@/components/stateful/AlertsFeed";

export default function AlertsPage() {
  return (
    <main className="p-8 max-w-5xl">
      <div className="mb-8 text-center">
        <h1
          className="font-display text-4xl text-gold-400 mb-2"
          style={{ textShadow: "0 0 24px rgba(247,243,229,0.35), 0 0 48px rgba(247,243,229,0.12)" }}
        >
          Alerts
        </h1>
        <p className="text-text-secondary text-sm max-w-xl mx-auto">
          Automatic notifications when price moves, volatility, or volume thresholds are crossed on your watchlist tickers.
        </p>
      </div>

      <AlertsFeed />
    </main>
  );
}
