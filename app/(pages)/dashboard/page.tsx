import DashboardOverview from "@/components/stateful/DashboardOverview";

export default function DashboardPage() {
  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-4xl text-gold-400 mb-1">Dashboard</h1>
        <p className="text-text-muted text-sm">Your market overview — alerts, signals, movers, and news at a glance.</p>
      </div>
      <DashboardOverview />
    </main>
  );
}
