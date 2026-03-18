import SimulateDashboard from "@/components/stateful/SimulateDashboard";

export default function SimulatePage() {
  return (
    <main className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-gold-400 mb-2">Simulate</h1>
        <p className="text-text-secondary text-sm">
          Build fake portfolios and test different strategies against real market prices.
        </p>
      </div>
      <SimulateDashboard />
    </main>
  );
}
