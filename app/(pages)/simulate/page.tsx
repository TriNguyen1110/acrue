import SimulateDashboard from "@/components/stateful/SimulateDashboard";

export default function SimulatePage() {
  return (
    <main className="p-8 max-w-6xl">
      <div className="mb-8 text-center">
        <h1
          className="font-display text-4xl text-gold-400 mb-2"
          style={{ textShadow: "0 0 24px rgba(247,243,229,0.35), 0 0 48px rgba(247,243,229,0.12)" }}
        >
          Simulate
        </h1>
        <p className="text-text-secondary text-sm max-w-xl mx-auto">
          Build paper portfolios with a locked-in start price and track real P&amp;L over time. Create multiple strategies and compare which performs best.
        </p>
      </div>
      <SimulateDashboard />
    </main>
  );
}
