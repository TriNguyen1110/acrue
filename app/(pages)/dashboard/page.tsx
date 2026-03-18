import DashboardOverview from "@/components/stateful/DashboardOverview";

export default function DashboardPage() {
  return (
    <main className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 text-center">
        <h1
          className="font-display text-4xl text-gold-400 mb-2"
          style={{ textShadow: "0 0 24px rgba(247,243,229,0.35), 0 0 48px rgba(247,243,229,0.12)" }}
        >
          Dashboard
        </h1>
        <p className="text-text-secondary text-sm max-w-xl mx-auto">
          Your command center — unread alerts, top-scored signals, biggest movers, and the latest news, all at a glance.
        </p>
      </div>
      <DashboardOverview />
    </main>
  );
}
