"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Spinner, Input } from "@heroui/react";
import type {
  PortfolioHolding,
  PortfolioResponse,
  OptimizeResponse,
  RiskProfile,
} from "@/types/portfolio";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtUsd(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

function sign(n: number): string {
  return n >= 0 ? "+" : "-";
}

function pnlColor(n: number): string {
  return n >= 0 ? "text-emerald-400" : "text-rose-400";
}

// ── Summary bar ───────────────────────────────────────────────────────────────

interface SummaryBarProps {
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
  sharpeRatio: number;
  expectedReturn: number;
  volatility: number;
}

function SummaryBar({
  totalValue,
  totalPnl,
  totalPnlPct,
  sharpeRatio,
  expectedReturn,
  volatility,
}: SummaryBarProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Total Value */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "rgba(10,22,40,0.8)",
          border: "1px solid rgba(247,243,229,0.08)",
        }}
      >
        <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
          Total Value
        </div>
        <div className="text-2xl font-display text-gold-400">
          ${totalValue.toFixed(2)}
        </div>
      </div>

      {/* Total P&L */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "rgba(10,22,40,0.8)",
          border: "1px solid rgba(247,243,229,0.08)",
        }}
      >
        <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
          Total P&amp;L
        </div>
        <div className={`text-2xl font-display ${pnlColor(totalPnl)}`}>
          {sign(totalPnl)}
          {fmtUsd(totalPnl)}
        </div>
        <div className={`text-xs font-mono mt-0.5 ${pnlColor(totalPnlPct)}`}>
          {sign(totalPnlPct)}
          {fmt(Math.abs(totalPnlPct))}%
        </div>
      </div>

      {/* Sharpe Ratio */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "rgba(10,22,40,0.8)",
          border: "1px solid rgba(247,243,229,0.08)",
        }}
      >
        <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
          Sharpe Ratio
        </div>
        <div className="text-2xl font-display text-text-primary">
          {fmt(sharpeRatio)}
        </div>
      </div>

      {/* Expected Return / Vol */}
      <div
        className="rounded-xl p-4"
        style={{
          background: "rgba(10,22,40,0.8)",
          border: "1px solid rgba(247,243,229,0.08)",
        }}
      >
        <div className="text-[11px] uppercase tracking-widest text-text-muted mb-1">
          Exp. Return / Vol
        </div>
        <div className="text-xl font-display text-text-primary">
          {fmt(expectedReturn * 100)}% /{" "}
          <span className="text-text-secondary">{fmt(volatility * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Inline edit row ───────────────────────────────────────────────────────────

interface HoldingRowProps {
  holding: PortfolioHolding;
  onUpdate: (
    ticker: string,
    updates: { shares?: number; avgCost?: number }
  ) => Promise<void>;
  onRemove: (ticker: string) => Promise<void>;
}

function HoldingRow({ holding, onUpdate, onRemove }: HoldingRowProps) {
  const [editing, setEditing] = useState(false);
  const [editShares, setEditShares] = useState(String(holding.shares));
  const [editAvgCost, setEditAvgCost] = useState(String(holding.avgCost));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleSave() {
    const shares = parseFloat(editShares);
    const avgCost = parseFloat(editAvgCost);
    if (isNaN(shares) || isNaN(avgCost) || shares <= 0 || avgCost <= 0) return;
    setSaving(true);
    try {
      await onUpdate(holding.ticker, { shares, avgCost });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await onRemove(holding.ticker);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <tr
      className="border-b last:border-0 hover:bg-navy-700/30 transition-colors"
      style={{ borderColor: "rgba(247,243,229,0.06)" }}
    >
      {/* Ticker */}
      <td className="px-4 py-3 font-mono text-sm text-gold-400 font-semibold">
        {holding.ticker}
      </td>

      {/* Shares */}
      <td className="px-4 py-3 text-sm text-text-secondary font-mono">
        {editing ? (
          <Input
            size="sm"
            value={editShares}
            onChange={(e) => setEditShares(e.target.value)}
            className="w-24"
            classNames={{
              input: "text-xs font-mono",
              inputWrapper: "bg-navy-700 border-navy-600",
            }}
          />
        ) : (
          <span
            className="cursor-pointer hover:text-gold-400 transition-colors"
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            {fmt(holding.shares)}
          </span>
        )}
      </td>

      {/* Avg Cost */}
      <td className="px-4 py-3 text-sm text-text-secondary font-mono">
        {editing ? (
          <Input
            size="sm"
            value={editAvgCost}
            onChange={(e) => setEditAvgCost(e.target.value)}
            className="w-28"
            classNames={{
              input: "text-xs font-mono",
              inputWrapper: "bg-navy-700 border-navy-600",
            }}
          />
        ) : (
          <span
            className="cursor-pointer hover:text-gold-400 transition-colors"
            onClick={() => setEditing(true)}
            title="Click to edit"
          >
            ${fmt(holding.avgCost)}
          </span>
        )}
      </td>

      {/* Current Price */}
      <td className="px-4 py-3 text-sm text-text-primary font-mono">
        ${fmt(holding.currentPrice)}
      </td>

      {/* Market Value */}
      <td className="px-4 py-3 text-sm text-text-primary font-mono">
        ${fmt(holding.marketValue)}
      </td>

      {/* P&L */}
      <td className={`px-4 py-3 text-sm font-mono ${pnlColor(holding.pnl)}`}>
        {sign(holding.pnl)}
        {fmtUsd(holding.pnl)}
      </td>

      {/* P&L % */}
      <td className={`px-4 py-3 text-sm font-mono ${pnlColor(holding.pnlPct)}`}>
        {sign(holding.pnlPct)}{fmt(Math.abs(holding.pnlPct))}%
      </td>

      {/* Ann. Vol */}
      <td className="px-4 py-3 text-sm font-mono text-text-secondary">
        {holding.annualVolPct !== null ? `${holding.annualVolPct}%` : "—"}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-2 py-1 rounded-lg bg-gold-600/20 border border-gold-600/40 text-gold-400 hover:bg-gold-600/30 transition-colors disabled:opacity-40"
              >
                {saving ? <Spinner size="sm" color="warning" /> : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditShares(String(holding.shares));
                  setEditAvgCost(String(holding.avgCost));
                }}
                className="text-xs px-2 py-1 rounded-lg border border-navy-600 text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-text-muted hover:text-gold-400 transition-colors"
                title="Edit"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="text-xs text-text-muted hover:text-rose-400 transition-colors disabled:opacity-40"
                title="Remove holding"
              >
                {removing ? (
                  <Spinner size="sm" color="default" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Add Holding form ──────────────────────────────────────────────────────────

interface AddHoldingFormProps {
  onAdd: (ticker: string, shares: number, avgCost: number) => Promise<void>;
}

interface AssetSearchResult {
  ticker:     string;
  name:       string;
  sector:     string | null;
  exchange:   string | null;
  quoteType:  string | null;
  diversifies?: boolean;
}

function AddHoldingForm({ onAdd }: AddHoldingFormProps) {
  const [ticker,   setTicker]   = useState("");
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [shares,   setShares]   = useState("");
  const [avgCost,  setAvgCost]  = useState("");
  const [adding,   setAdding]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const searchRef  = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/v1/assets/search?q=${encodeURIComponent(query)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function selectTicker(t: string) {
    setTicker(t);
    setQuery(t);
    setResults([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const sharesNum  = parseFloat(shares);
    const avgCostNum = parseFloat(avgCost);

    if (!ticker.trim()) return setError("Ticker is required.");
    if (isNaN(sharesNum)  || sharesNum  <= 0) return setError("Shares must be a positive number.");
    if (isNaN(avgCostNum) || avgCostNum <= 0) return setError("Avg cost must be a positive number.");

    setAdding(true);
    try {
      await onAdd(ticker.trim().toUpperCase(), sharesNum, avgCostNum);
      setTicker("");
      setQuery("");
      setShares("");
      setAvgCost("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add holding.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end justify-center gap-3 flex-wrap pt-4 border-t"
      style={{ borderColor: "rgba(247,243,229,0.06)" }}
    >
      {/* Ticker with autocomplete */}
      <div className="flex flex-col gap-1" ref={searchRef}>
        <label className="text-[10px] uppercase tracking-widest text-text-muted">
          Ticker
        </label>
        <div className="relative">
          <Input
            size="sm"
            placeholder="Search ticker..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setTicker(""); }}
            className="w-44"
            endContent={searching ? <Spinner size="sm" color="default" /> : null}
            classNames={{
              input: "text-sm font-mono",
              inputWrapper: "bg-navy-700 border-navy-600 focus-within:border-gold-400/60",
            }}
          />
          {results.length > 0 && (
            <div className="absolute top-full mt-1 w-64 bg-navy-800 border border-navy-600 rounded-xl shadow-2xl z-50 overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.ticker}
                  type="button"
                  onClick={() => selectTicker(r.ticker)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-navy-700 transition-colors text-left"
                >
                  <span className="font-mono text-sm font-medium text-gold-400 shrink-0">{r.ticker}</span>
                  <span className="text-xs text-text-secondary truncate">{r.name}</span>
                  {r.sector && (
                    <span className="ml-auto text-[10px] bg-navy-600 text-text-muted px-1.5 py-0.5 rounded-full shrink-0">
                      {r.sector}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-text-muted">
          Shares
        </label>
        <Input
          size="sm"
          placeholder="10"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          className="w-24"
          classNames={{
            input: "text-sm font-mono",
            inputWrapper: "bg-navy-700 border-navy-600 focus-within:border-gold-400/60",
          }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-widest text-text-muted">
          Avg Cost ($)
        </label>
        <Input
          size="sm"
          placeholder="150.00"
          value={avgCost}
          onChange={(e) => setAvgCost(e.target.value)}
          className="w-28"
          classNames={{
            input: "text-sm font-mono",
            inputWrapper: "bg-navy-700 border-navy-600 focus-within:border-gold-400/60",
          }}
        />
      </div>

      <Button
        type="submit"
        size="sm"
        isDisabled={adding}
        className="h-9 px-5 text-xs font-medium rounded-lg"
        style={{
          background: "linear-gradient(135deg, #EDE4CC, #F7F3E5)",
          color: "#050D1A",
          fontWeight: 600,
        }}
      >
        {adding ? <Spinner size="sm" color="default" /> : "Add Holding"}
      </Button>

      {error && (
        <p className="text-xs text-rose-400 w-full">{error}</p>
      )}
    </form>
  );
}

// ── Optimization panel ────────────────────────────────────────────────────────

interface OptimizationPanelProps {
  tickers: string[];
}

const RISK_LABELS: { key: RiskProfile; label: string; desc: string }[] = [
  { key: "conservative", label: "Conservative", desc: "A = 10, capital preservation" },
  { key: "moderate", label: "Moderate", desc: "A = 3, balanced growth" },
  { key: "aggressive", label: "Aggressive", desc: "A = 1, maximum return" },
];

function OptimizationPanel({ tickers }: OptimizationPanelProps) {
  const [riskProfile, setRiskProfile] = useState<RiskProfile>("moderate");
  const [optimizing, setOptimizing] = useState(false);
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOptimize() {
    setOptimizing(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/portfolio/optimize?risk=${riskProfile}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? "Optimization failed.");
      }
      const data: OptimizeResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Optimization failed.");
    } finally {
      setOptimizing(false);
    }
  }

  if (tickers.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{
        background: "rgba(10,22,40,0.8)",
        border: "1px solid rgba(247,243,229,0.08)",
      }}
    >
      <div>
        <h2 className="font-display text-xl text-gold-400 mb-1">
          Portfolio Optimisation
        </h2>
        <p className="text-xs text-text-muted">
          Mean-variance optimisation using 52-week range as annual volatility
          proxy. Equal correlation ρ = 0.3 assumed across all pairs.
        </p>
      </div>

      {/* Risk profile selector */}
      <div className="flex gap-2 flex-wrap">
        {RISK_LABELS.map((profile) => (
          <button
            key={profile.key}
            onClick={() => setRiskProfile(profile.key)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
              riskProfile === profile.key
                ? "bg-gold-600/20 border-gold-600/40 text-gold-400"
                : "bg-transparent border-navy-600 text-text-secondary hover:border-navy-500 hover:text-text-primary"
            }`}
          >
            <div>{profile.label}</div>
            <div className="text-[10px] opacity-60 mt-0.5">{profile.desc}</div>
          </button>
        ))}
      </div>

      {/* Optimize button */}
      <Button
        onPress={handleOptimize}
        isDisabled={optimizing}
        className="px-6 text-sm font-semibold rounded-xl"
        style={{
          background: "linear-gradient(135deg, #EDE4CC, #F7F3E5)",
          color: "#050D1A",
        }}
      >
        {optimizing ? (
          <span className="flex items-center gap-2">
            <Spinner size="sm" color="default" />
            Optimising…
          </span>
        ) : (
          "Optimise Allocation"
        )}
      </Button>

      {error && (
        <p className="text-xs text-rose-400">{error}</p>
      )}

      {/* Results */}
      {result && !optimizing && (
        <div className="space-y-4">
          {/* Suggested weights */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-text-secondary uppercase tracking-wider">
              Suggested Allocation
            </div>
            {Object.entries(result.suggestedWeights)
              .sort(([, a], [, b]) => b - a)
              .map(([ticker, weight]) => (
                <div key={ticker} className="flex items-center gap-3">
                  <span className="font-mono text-xs text-gold-400 w-14 shrink-0">
                    {ticker}
                  </span>
                  <div className="flex-1 bg-navy-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(weight * 100).toFixed(1)}%`,
                        background:
                          "linear-gradient(90deg, #D4CCAE, #F7F3E5)",
                      }}
                    />
                  </div>
                  <span className="font-mono text-xs text-text-secondary w-12 text-right">
                    {(weight * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>

          {/* Projected metrics */}
          <div
            className="grid grid-cols-2 gap-3 pt-3 border-t"
            style={{ borderColor: "rgba(247,243,229,0.06)" }}
          >
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-0.5">
                Projected Return (Ann.)
              </div>
              <div
                className={`text-lg font-display font-medium ${pnlColor(result.projectedReturn)}`}
              >
                {sign(result.projectedReturn)}
                {fmt(Math.abs(result.projectedReturn * 100))}%
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-text-muted mb-0.5">
                Projected Volatility (Ann.)
              </div>
              <div className="text-lg font-display font-medium text-text-secondary">
                {fmt(result.projectedVolatility * 100)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="rounded-2xl px-6 py-16 text-center"
      style={{
        background: "rgba(10,22,40,0.8)",
        border: "1px solid rgba(247,243,229,0.08)",
      }}
    >
      <div className="text-4xl font-display text-text-secondary mb-3">
        No Holdings
      </div>
      <p className="text-sm text-text-muted max-w-xs mx-auto">
        Add your first holding below to start tracking performance and
        optimising your portfolio allocation.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PortfolioDashboard() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/portfolio");
      if (!res.ok) throw new Error("Failed to load portfolio.");
      const data: PortfolioResponse = await res.json();
      setPortfolio(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load portfolio.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpdate(
    ticker: string,
    updates: { shares?: number; avgCost?: number }
  ) {
    const res = await fetch(`/api/v1/portfolio/holdings/${ticker}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message ?? "Update failed.");
    }
    await load();
  }

  async function handleRemove(ticker: string) {
    const res = await fetch(`/api/v1/portfolio/holdings/${ticker}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message ?? "Remove failed.");
    }
    await load();
  }

  async function handleAdd(
    ticker: string,
    shares: number,
    avgCost: number
  ) {
    const res = await fetch("/api/v1/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker, shares, avgCost }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message ?? "Failed to add holding.");
    }
    await load();
  }

  // ── Loading ────────────────────────────────────────────────────────────────

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

  const holdings = portfolio?.holdings ?? [];
  const metrics = portfolio?.metrics ?? {
    expectedReturn: 0,
    volatility: 0,
    sharpeRatio: 0,
    diversificationScore: 0,
  };
  const totalValue = portfolio?.totalValue ?? 0;
  const totalPnl = portfolio?.totalPnl ?? 0;
  const totalPnlPct = portfolio?.totalPnlPct ?? 0;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      {holdings.length > 0 && (
        <SummaryBar
          totalValue={totalValue}
          totalPnl={totalPnl}
          totalPnlPct={totalPnlPct}
          sharpeRatio={metrics.sharpeRatio}
          expectedReturn={metrics.expectedReturn}
          volatility={metrics.volatility}
        />
      )}

      {/* Holdings table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "rgba(10,22,40,0.8)",
          border: "1px solid rgba(247,243,229,0.08)",
        }}
      >
        {holdings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: "rgba(247,243,229,0.08)" }}
                >
                  {[
                    "Ticker",
                    "Shares",
                    "Avg Cost",
                    "Current Price",
                    "Market Value",
                    "P&L",
                    "P&L %",
                    "Ann. Vol",
                    "",
                  ].map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-text-muted font-medium"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <HoldingRow
                    key={holding.id}
                    holding={holding}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* Add holding form — outside overflow-hidden container so the dropdown isn't clipped */}
      <div
        className="rounded-2xl px-6 py-5"
        style={{
          background: "rgba(10,22,40,0.8)",
          border: "1px solid rgba(247,243,229,0.08)",
        }}
      >
        <AddHoldingForm onAdd={handleAdd} />
      </div>

      {/* Diversification score */}
      {holdings.length > 1 && (
        <div
          className="flex items-center gap-4 rounded-xl px-5 py-3"
          style={{
            background: "rgba(10,22,40,0.8)",
            border: "1px solid rgba(247,243,229,0.08)",
          }}
        >
          <span className="text-xs text-text-muted uppercase tracking-wider">
            Diversification
          </span>
          <div className="flex-1 bg-navy-700 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${metrics.diversificationScore}%`,
                background: "linear-gradient(90deg, #D4CCAE, #F7F3E5)",
              }}
            />
          </div>
          <span className="font-mono text-xs text-gold-400 w-8 text-right">
            {metrics.diversificationScore}
          </span>
        </div>
      )}

      {/* Optimisation panel */}
      <OptimizationPanel tickers={holdings.map((h) => h.ticker)} />

      {/* Methodology footnote */}
      {holdings.length > 0 && (
        <div className="text-[11px] text-text-muted leading-relaxed border-t border-navy-700 pt-4">
          <span className="text-text-secondary font-medium">Methodology: </span>
          Annual volatility estimated from 52-week high/low range: σ = (H52 −
          L52) / (2 × 1.96 × price). Equal pairwise correlation ρ = 0.3
          assumed. Optimisation: projected gradient ascent on U = μ − A × σ²
          (500 iterations), weights projected onto probability simplex after
          each step. Sharpe = (μ − 5%) / σ. Risk aversion A: conservative =
          10, moderate = 3, aggressive = 1.
        </div>
      )}
    </div>
  );
}
