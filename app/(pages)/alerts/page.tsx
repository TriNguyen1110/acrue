import AlertsFeed from "@/components/stateful/AlertsFeed";

export default function AlertsPage() {
  return (
    <main className="p-8 max-w-5xl">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl text-gold-400 mb-2">Alerts</h1>
        <p className="text-text-secondary text-sm">Smart event detection for your watchlist.</p>
      </div>

      <AlertsFeed />
    </main>
  );
}
