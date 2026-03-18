import PortfolioDashboard from "@/components/stateful/PortfolioDashboard";

export default function PortfolioPage() {
  return (
    <main className="p-8 max-w-6xl">
      <div className="mb-8 text-center">
        <h1
          className="font-display text-4xl text-gold-400 mb-2"
          style={{ textShadow: "0 0 24px rgba(247,243,229,0.35), 0 0 48px rgba(247,243,229,0.12)" }}
        >
          Portfolio
        </h1>
        <p className="text-text-secondary text-sm max-w-xl mx-auto">
          Track your real holdings, view risk metrics, and get mean-variance optimized weight suggestions to maximise risk-adjusted return.
        </p>
      </div>
      <PortfolioDashboard />
    </main>
  );
}
