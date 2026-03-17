"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@heroui/react";
import SignalCard from "@/components/ui/SignalCard";
import type { SignalScore, SignalDirection, ConfidenceLevel } from "@/types";

// ── Filter config ─────────────────────────────────────────────────────────────

type DirectionFilter = "all" | SignalDirection;
type ConfidenceFilter = "all" | ConfidenceLevel;

const DIRECTION_TABS: { key: DirectionFilter; label: string }[] = [
  { key: "all",     label: "All"     },
  { key: "bullish", label: "Bullish" },
  { key: "bearish", label: "Bearish" },
];

const CONFIDENCE_TABS: { key: ConfidenceFilter; label: string }[] = [
  { key: "all",    label: "All Confidence" },
  { key: "high",   label: "High"           },
  { key: "medium", label: "Medium"         },
  { key: "low",    label: "Low"            },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function SignalsDashboard() {
  const [scores,    setScores]    = useState<SignalScore[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [conf,      setConf]      = useState<ConfidenceFilter>("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/signals");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setScores(data.scores ?? []);
      setError(null);
    } catch {
      setError("Could not load signals.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 300_000); // refresh every 5 min (signal TTL)
    return () => clearInterval(interval);
  }, [load]);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const displayed = scores.filter((s) => {
    if (direction !== "all" && s.direction  !== direction) return false;
    if (conf      !== "all" && s.confidence !== conf)      return false;
    return true;
  });

  // ── Market summary stats ──────────────────────────────────────────────────
  const bullishCount = scores.filter((s) => s.direction === "bullish").length;
  const bearishCount = scores.filter((s) => s.direction === "bearish").length;
  const avgScore = scores.length
    ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length)
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" color="warning" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-rose-400 text-sm">
        {error}
      </div>
    );
  }

  if (scores.length === 0) {
    return (
      <div className="bg-navy-800 border border-navy-600 rounded-2xl p-12 text-center space-y-2">
        <div className="text-2xl font-display text-text-secondary">No watchlist items</div>
        <p className="text-sm text-text-muted">
          Add tickers to your watchlist to see signal scores and projections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Portfolio summary bar ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-4 text-center">
          <div className="text-2xl font-display text-gold-400">{avgScore ?? "—"}</div>
          <div className="text-[11px] uppercase tracking-widest text-text-muted mt-1">Avg Signal</div>
        </div>
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-4 text-center">
          <div className="text-2xl font-display text-emerald-400">{bullishCount}</div>
          <div className="text-[11px] uppercase tracking-widest text-text-muted mt-1">Bullish</div>
        </div>
        <div className="bg-navy-800 border border-navy-600 rounded-xl p-4 text-center">
          <div className="text-2xl font-display text-rose-400">{bearishCount}</div>
          <div className="text-[11px] uppercase tracking-widest text-text-muted mt-1">Bearish</div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        {DIRECTION_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setDirection(tab.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
              direction === tab.key
                ? "bg-gold-400/10 border-gold-400/40 text-gold-400"
                : "border-navy-600 text-text-secondary hover:border-navy-500 hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="w-px h-4 bg-navy-600 mx-1" />
        {CONFIDENCE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setConf(tab.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
              conf === tab.key
                ? "bg-gold-400/10 border-gold-400/40 text-gold-400"
                : "border-navy-600 text-text-secondary hover:border-navy-500 hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <div className="ml-auto text-xs text-text-muted">
          {displayed.length} of {scores.length} asset{scores.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* ── Signal cards grid ── */}
      {displayed.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">
          No signals match the selected filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayed.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {/* ── Methodology footnote ── */}
      <div className="text-[11px] text-text-muted leading-relaxed border-t border-navy-700 pt-4">
        <span className="text-text-secondary font-medium">Methodology: </span>
        Composite score = Price Momentum (35%) + Analyst Consensus (25%) + Valuation (20%) + News Sentiment (20%).
        30-day projection uses 52-week range as annual volatility proxy, ±1.645σ for 90% CI.
        Sharpe = (annualised expected return − 5% risk-free) / annual vol.
        PEG = P/E ÷ analyst price-target implied growth rate.
        Scores refresh every 5 minutes.
      </div>
    </div>
  );
}
