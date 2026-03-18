import SignalsDashboard from "@/components/stateful/SignalsDashboard";

export default function SignalsPage() {
  return (
    <main className="p-8 max-w-6xl">
      <div className="mb-8 text-center">
        <h1
          className="font-display text-4xl text-gold-400 mb-2"
          style={{ textShadow: "0 0 24px rgba(247,243,229,0.35), 0 0 48px rgba(247,243,229,0.12)" }}
        >
          Signals
        </h1>
        <p className="text-text-secondary text-sm max-w-xl mx-auto">
          Composite buy/sell scores built from price momentum, analyst consensus, valuation, and news sentiment — with 30-day statistical projections.
        </p>
      </div>

      <SignalsDashboard />
    </main>
  );
}
