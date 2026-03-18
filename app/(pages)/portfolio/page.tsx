import PortfolioDashboard from "@/components/stateful/PortfolioDashboard";

export default function PortfolioPage() {
  return (
    <main className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-gold-400 mb-2">Portfolio</h1>
        <p className="text-text-secondary text-sm">
          Track holdings and optimise allocations.
        </p>
      </div>
      <PortfolioDashboard />
    </main>
  );
}
