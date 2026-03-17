import SignalsDashboard from "@/components/stateful/SignalsDashboard";

export default function SignalsPage() {
  return (
    <main className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-gold-400 mb-2">Signals</h1>
        <p className="text-text-secondary text-sm">
          Multi-factor scores with statistical projections for your watchlist.
        </p>
      </div>

      <SignalsDashboard />
    </main>
  );
}
