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

  const [showMethodology, setShowMethodology] = useState(false);

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

      {/* ── Methodology explainer ── */}
      <div className="border-t border-navy-700 pt-4">
        <button
          onClick={() => setShowMethodology((v) => !v)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-gold-400 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${showMethodology ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          {showMethodology ? "Hide methodology" : "How are signals calculated?"}
        </button>

        {showMethodology && (
          <div className="mt-4 space-y-4">
            {/* Score scale */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">Score scale (0–100)</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full" style={{ background: "linear-gradient(to right, #f87171, #fbbf24, #34d399)" }} />
              </div>
              <div className="flex justify-between text-[11px] text-text-muted">
                <span>0 — strongly bearish</span>
                <span>50 — neutral</span>
                <span>100 — strongly bullish</span>
              </div>
              <p className="text-[11px] text-text-muted pt-1">
                Scores above 50 are bullish (green), below 50 are bearish (red). Confidence reflects how many data sources contributed — high confidence means all four components had fresh data.
              </p>
            </div>

            {/* Four components */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  label: "Price Momentum",
                  weight: "35%",
                  color: "#34d399",
                  desc: "Measures how strongly the stock is trending. Combines today's % price change and where the current price sits within its 52-week range. A stock near its 52-week high with a positive day scores highest.",
                },
                {
                  label: "Analyst Consensus",
                  weight: "25%",
                  color: "#60a5fa",
                  desc: "Aggregates Wall Street sell-side ratings (Buy / Hold / Sell) and the % upside to the mean analyst price target. High consensus + large upside = strong bullish signal.",
                },
                {
                  label: "Valuation",
                  weight: "20%",
                  color: "#f59e0b",
                  desc: "Compares P/E ratio to sector norms and estimates PEG (Price/Earnings-to-Growth) using the analyst price target as an implied growth rate. Lower P/E + reasonable PEG scores higher.",
                },
                {
                  label: "News Sentiment",
                  weight: "20%",
                  color: "#a78bfa",
                  desc: "Scores the tone of news articles from the past 7 days using AFINN sentiment analysis. High-impact articles (strong positive or negative language) are weighted 2× vs. neutral ones.",
                },
              ].map(({ label, weight, color, desc }) => (
                <div key={label} className="bg-navy-800 border border-navy-600 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">{label}</span>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full border"
                      style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
                      {weight}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>

            {/* Projection + Sharpe */}
            <div className="bg-navy-800 border border-navy-600 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-text-primary uppercase tracking-wider">30-day projection & Sharpe ratio</p>
              <p className="text-[11px] text-text-muted leading-relaxed">
                The price range shown on each card is a <strong className="text-text-secondary">90% confidence interval</strong> — there&apos;s a 90% chance the price lands within that band based on recent volatility.
                Volatility is estimated from the 52-week high/low range (σ ≈ range / 3.92 / price).
              </p>
              <p className="text-[11px] text-text-muted leading-relaxed">
                The <strong className="text-text-secondary">Sharpe ratio</strong> measures risk-adjusted return: how much expected return you get per unit of volatility, above a 5% risk-free rate baseline.
                Above 1.0 is generally considered good; above 2.0 is excellent.
              </p>
            </div>

            <p className="text-[11px] text-text-muted">Scores refresh every 5 minutes. Not financial advice.</p>
          </div>
        )}
      </div>
    </div>
  );
}
