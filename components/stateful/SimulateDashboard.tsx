"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Spinner } from "@heroui/react";
import type { SimPortfolio, SimHolding } from "@/types/simulate";

// ── Helpers ───────────────────────────────────────────────────────────────────

function pctColor(n: number) {
  if (n > 0) return "text-emerald-400";
  if (n < 0) return "text-rose-400";
  return "text-text-muted";
}

function fmtPct(n: number, decimals = 2) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Ticker search (reuses the same autocomplete pattern) ─────────────────────

interface AssetResult { ticker: string; name: string; sector?: string }

function useTickerSearch(query: string) {
  const [results, setResults] = useState<AssetResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (query.trim().length < 1) { setResults([]); return; }
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=6`);
        if (!res.ok) return;
        const data = await res.json() as AssetResult[];
        setResults(data);
      } catch { /* ignore */ }
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  return results;
}

// ── Add Holding form ─────────────────────────────────────────────────────────

interface AddHoldingFormProps {
  simPortId: string;
  onAdded:   () => void;
}

function AddHoldingForm({ simPortId, onAdded }: AddHoldingFormProps) {
  const [tickerQuery, setTickerQuery] = useState("");
  const [ticker,      setTicker]      = useState("");
  const [shares,      setShares]      = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [open,        setOpen]        = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useTickerSearch(tickerQuery);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleAdd() {
    const t = ticker || tickerQuery.toUpperCase().trim();
    const s = parseFloat(shares);
    if (!t) { setError("Select a ticker."); return; }
    if (!s || s <= 0) { setError("Enter a valid number of shares."); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/simulate/${simPortId}/holdings`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ticker: t, shares: s }),
      });
      if (!res.ok) {
        const d = await res.json() as { message?: string };
        throw new Error(d.message ?? "Failed to add.");
      }
      setTickerQuery(""); setTicker(""); setShares("");
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 items-start flex-wrap">
      {/* Ticker search */}
      <div ref={wrapRef} className="relative">
        <input
          value={tickerQuery}
          onChange={(e) => { setTickerQuery(e.target.value); setTicker(""); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search ticker…"
          className="h-8 px-3 rounded-lg text-xs bg-navy-700 border border-navy-600 text-text-secondary placeholder-text-muted outline-none focus:border-gold-600/50 w-44"
        />
        {open && results.length > 0 && !ticker && (
          <div
            className="absolute top-full left-0 mt-1 z-50 rounded-xl py-1 w-64 shadow-xl"
            style={{ background: "rgba(10,22,40,0.98)", border: "1px solid rgba(247,243,229,0.12)" }}
          >
            {results.map((r) => (
              <button
                key={r.ticker}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setTicker(r.ticker); setTickerQuery(r.ticker); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-navy-700/60 transition-colors"
              >
                <span className="font-mono text-xs text-gold-400">{r.ticker}</span>
                <span className="text-[11px] text-text-muted ml-2 truncate">{r.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Shares */}
      <input
        type="number"
        min="0.0001"
        step="any"
        value={shares}
        onChange={(e) => setShares(e.target.value)}
        placeholder="Shares"
        className="h-8 px-3 rounded-lg text-xs bg-navy-700 border border-navy-600 text-text-secondary placeholder-text-muted outline-none focus:border-gold-600/50 w-24"
        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
      />

      <button
        onClick={handleAdd}
        disabled={loading}
        className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 disabled:opacity-50 transition-all"
        style={{
          background: "linear-gradient(135deg, #D4CCAE, #F7F3E5)",
          color: "#050D1A",
        }}
      >
        {loading ? <Spinner size="sm" color="default" /> : null}
        Add
      </button>

      {error && <span className="text-[11px] text-rose-400 self-center">{error}</span>}
    </div>
  );
}

// ── Holdings table ────────────────────────────────────────────────────────────

interface HoldingsTableProps {
  holdings:  SimHolding[];
  simPortId: string;
  onRemoved: () => void;
}

function HoldingsTable({ holdings, simPortId, onRemoved }: HoldingsTableProps) {
  const [removing, setRemoving] = useState<string | null>(null);

  async function handleRemove(ticker: string) {
    setRemoving(ticker);
    try {
      await fetch(`/api/v1/simulate/${simPortId}/holdings/${ticker}`, { method: "DELETE" });
      onRemoved();
    } catch { /* silent */ } finally {
      setRemoving(null);
    }
  }

  if (holdings.length === 0) {
    return (
      <p className="text-xs text-text-muted py-3">
        No holdings yet. Add tickers above to start tracking.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b" style={{ borderColor: "rgba(247,243,229,0.06)" }}>
            {["Ticker", "Shares", "Start", "Now", "Return", ""].map((h) => (
              <th key={h} className="text-left text-[10px] uppercase tracking-widest text-text-muted font-medium pb-2 pr-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.ticker} className="border-b last:border-0" style={{ borderColor: "rgba(247,243,229,0.04)" }}>
              <td className="py-2 pr-3 font-mono text-gold-400 font-medium">{h.ticker}</td>
              <td className="py-2 pr-3 font-mono text-text-secondary">{h.shares}</td>
              <td className="py-2 pr-3 font-mono text-text-muted">{fmtUsd(h.startPrice)}</td>
              <td className="py-2 pr-3 font-mono text-text-secondary">{fmtUsd(h.currentPrice)}</td>
              <td className={`py-2 pr-3 font-mono font-semibold ${pctColor(h.returnPct)}`}>
                {fmtPct(h.returnPct)}
              </td>
              <td className="py-2">
                <button
                  onClick={() => handleRemove(h.ticker)}
                  disabled={removing === h.ticker}
                  className="text-text-muted hover:text-rose-400 transition-colors disabled:opacity-40"
                  aria-label={`Remove ${h.ticker}`}
                >
                  {removing === h.ticker
                    ? <Spinner size="sm" color="default" />
                    : <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                  }
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Sim portfolio card ────────────────────────────────────────────────────────

interface SimCardProps {
  sim:       SimPortfolio;
  onDeleted: () => void;
  onRefresh: () => void;
}

function SimCard({ sim, onDeleted, onRefresh }: SimCardProps) {
  const [deleting,  setDeleting]  = useState(false);
  const [expanded,  setExpanded]  = useState(true);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/v1/simulate/${sim.id}`, { method: "DELETE" });
      onDeleted();
    } catch { setDeleting(false); }
  }

  const ret = sim.metrics.totalReturnPct;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-4 border-b cursor-pointer"
        style={{ borderColor: "rgba(247,243,229,0.06)" }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <h3 className="text-sm font-semibold text-text-primary truncate">{sim.name}</h3>
            {sim.description && (
              <p className="text-[11px] text-text-muted truncate">{sim.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0">
          {/* Total return */}
          <div className="text-right">
            <div className={`font-mono text-base font-semibold ${pctColor(ret)}`}>
              {fmtPct(ret)}
            </div>
            <div className="text-[10px] text-text-muted">since {timeAgo(sim.createdAt)}</div>
          </div>

          {/* Current value */}
          <div className="text-right hidden sm:block">
            <div className="font-mono text-sm text-text-secondary">
              {fmtUsd(sim.metrics.totalCurrentValue)}
            </div>
            <div className="text-[10px] text-text-muted">
              from {fmtUsd(sim.metrics.totalStartValue)}
            </div>
          </div>

          {/* Holdings count */}
          <div className="text-right hidden md:block">
            <div className="font-mono text-sm text-text-secondary">{sim.holdings.length}</div>
            <div className="text-[10px] text-text-muted">holdings</div>
          </div>

          {/* Chevron */}
          <svg
            xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {/* Top gainer / loser */}
          {(sim.metrics.topGainer || sim.metrics.topLoser) && (
            <div className="flex gap-4 text-[11px]">
              {sim.metrics.topGainer && (
                <span className="text-text-muted">
                  Top gainer: <span className="font-mono text-emerald-400">{sim.metrics.topGainer}</span>
                </span>
              )}
              {sim.metrics.topLoser && (
                <span className="text-text-muted">
                  Top loser: <span className="font-mono text-rose-400">{sim.metrics.topLoser}</span>
                </span>
              )}
            </div>
          )}

          {/* Holdings table */}
          <HoldingsTable
            holdings={sim.holdings}
            simPortId={sim.id}
            onRemoved={onRefresh}
          />

          {/* Add holding */}
          <AddHoldingForm simPortId={sim.id} onAdded={onRefresh} />

          {/* Delete portfolio */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-rose-400 transition-colors disabled:opacity-40"
            >
              {deleting ? <Spinner size="sm" color="default" /> : null}
              Delete portfolio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create portfolio form ─────────────────────────────────────────────────────

interface CreateFormProps {
  onCreate: () => void;
}

function CreateForm({ onCreate }: CreateFormProps) {
  const [name,    setName]    = useState("");
  const [desc,    setDesc]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) { setError("Name is required."); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/v1/simulate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim(), description: desc.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json() as { message?: string };
        throw new Error(d.message ?? "Failed to create.");
      }
      setName(""); setDesc("");
      onCreate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
    >
      <h3 className="text-sm font-semibold text-text-primary mb-4">New Simulated Portfolio</h3>
      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tech Overweight"
            className="w-full h-9 px-3 rounded-lg text-sm bg-navy-700 border border-navy-600 text-text-primary placeholder-text-muted outline-none focus:border-gold-600/50"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] uppercase tracking-widest text-text-muted mb-1.5">Description <span className="normal-case text-text-muted">(optional)</span></label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="e.g. Heavy NVDA + MSFT allocation"
            className="w-full h-9 px-3 rounded-lg text-sm bg-navy-700 border border-navy-600 text-text-primary placeholder-text-muted outline-none focus:border-gold-600/50"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="h-9 px-5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50 transition-all shrink-0"
          style={{
            background: "linear-gradient(135deg, #D4CCAE, #F7F3E5)",
            color: "#050D1A",
          }}
        >
          {loading ? <Spinner size="sm" color="default" /> : null}
          Create
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function SimulateDashboard() {
  const [sims,    setSims]    = useState<SimPortfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/v1/simulate");
      if (!res.ok) throw new Error();
      setSims(await res.json() as SimPortfolio[]);
    } catch {
      setError("Could not load simulated portfolios.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Summary comparison bar — only shown when ≥2 portfolios with holdings
  const comparable = sims.filter((s) => s.holdings.length > 0);

  return (
    <div className="space-y-5">
      {/* Create form */}
      <CreateForm onCreate={load} />

      {/* Comparison strip */}
      {comparable.length >= 2 && (
        <div
          className="rounded-2xl p-4"
          style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
        >
          <p className="text-[10px] uppercase tracking-widest text-text-muted mb-3">Comparison</p>
          <div className="flex gap-4 flex-wrap">
            {[...comparable]
              .sort((a, b) => b.metrics.totalReturnPct - a.metrics.totalReturnPct)
              .map((s, rank) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-text-muted font-mono">#{rank + 1}</span>
                  <span className="text-xs text-text-secondary font-medium">{s.name}</span>
                  <span className={`font-mono text-xs font-semibold ${pctColor(s.metrics.totalReturnPct)}`}>
                    {fmtPct(s.metrics.totalReturnPct)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Portfolio list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="md" color="default" />
        </div>
      ) : error ? (
        <div
          className="rounded-2xl px-4 py-8 text-center text-sm text-rose-400"
          style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
        >
          {error}
        </div>
      ) : sims.length === 0 ? (
        <div
          className="rounded-2xl px-6 py-14 text-center"
          style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
        >
          <p className="text-text-secondary text-sm mb-1">No simulated portfolios yet.</p>
          <p className="text-text-muted text-xs">
            Create one above and add holdings to start comparing strategies.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sims.map((sim) => (
            <SimCard
              key={sim.id}
              sim={sim}
              onDeleted={load}
              onRefresh={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}
