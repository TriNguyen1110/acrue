"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input, Spinner, Skeleton } from "@heroui/react";
import StockCard from "@/components/ui/StockCard";
import type { WatchlistItem, AssetSearchResult } from "@/types";

// ── Data hooks ────────────────────────────────────────────────────────────────

function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/watchlist");
      if (!res.ok) throw new Error();
      setItems(await res.json());
      setError(null);
    } catch {
      setError("Could not load watchlist.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000); // refresh every 60s (quote TTL)
    return () => clearInterval(interval);
  }, [load]);

  return { items, setItems, loading, error, refresh: load };
}

function useSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return { query, setQuery, results, setResults, searching };
}

// ── Component ─────────────────────────────────────────────────────────────────

const columns = [
  { key: "asset",  label: "Asset" },
  { key: "price",  label: "Price",   className: "text-right" },
  { key: "change", label: "Change",  className: "text-right" },
  { key: "volume", label: "Avg Vol", className: "text-right" },
  { key: "cap",    label: "Mkt Cap", className: "text-right" },
  { key: "range",  label: "52W Range" },
  { key: "state",  label: "" },
  { key: "action", label: "" },
];

type FilterKey = "all" | "gainers" | "losers" | "etf";
type SortKey = "added" | "change_desc" | "change_asc" | "price_desc" | "price_asc" | "cap_desc" | "az";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",     label: "All" },
  { key: "gainers", label: "Gainers" },
  { key: "losers",  label: "Losers" },
  { key: "etf",     label: "ETF" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "added",       label: "Date Added" },
  { key: "change_desc", label: "Change % ↓" },
  { key: "change_asc",  label: "Change % ↑" },
  { key: "price_desc",  label: "Price ↓" },
  { key: "price_asc",   label: "Price ↑" },
  { key: "cap_desc",    label: "Market Cap ↓" },
  { key: "az",          label: "A → Z" },
];

function applyFilterSort(items: WatchlistItem[], filter: FilterKey, sort: SortKey): WatchlistItem[] {
  let out = [...items];
  if (filter === "gainers") out = out.filter((i) => i.quote.changePct > 0);
  if (filter === "losers")  out = out.filter((i) => i.quote.changePct < 0);
  if (filter === "etf")     out = out.filter((i) => i.quote.quoteType === "ETF");

  out.sort((a, b) => {
    switch (sort) {
      case "change_desc": return b.quote.changePct - a.quote.changePct;
      case "change_asc":  return a.quote.changePct - b.quote.changePct;
      case "price_desc":  return b.quote.price - a.quote.price;
      case "price_asc":   return a.quote.price - b.quote.price;
      case "cap_desc":    return (b.quote.marketCap ?? 0) - (a.quote.marketCap ?? 0);
      case "az":          return a.ticker.localeCompare(b.ticker);
      default:            return 0; // "added" — preserve server order
    }
  });
  return out;
}

export default function WatchlistTable() {
  const { items, setItems, loading, error, refresh } = useWatchlist();
  const { query, setQuery, results, setResults, searching } = useSearch();
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("added");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [setResults]);

  async function handleAdd(ticker: string) {
    setAdding(ticker);
    setAddError(null);
    try {
      const res = await fetch("/api/v1/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.message ?? "Failed to add ticker.");
      } else {
        setQuery("");
        setResults([]);
        await refresh();
      }
    } finally {
      setAdding(null);
    }
  }

  async function handleRemove(ticker: string) {
    setRemoving(ticker);
    try {
      await fetch(`/api/v1/watchlist/${ticker}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.ticker !== ticker));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-5" suppressHydrationWarning>
      {/* Search */}
      <div ref={searchRef} className="relative max-w-md">
        <Input
          id="watchlist-search"
          value={query}
          onValueChange={(v) => { setQuery(v); setAddError(null); }}
          placeholder="Search ticker or company name..."
          endContent={searching ? <Spinner size="sm" color="default" /> : null}
          classNames={{
            base: "max-w-md",
            inputWrapper: [
              "bg-navy-800 border border-navy-600 rounded-xl h-10",
              "hover:border-navy-500",
              "data-[focus=true]:border-navy-500 data-[focus=true]:shadow-none",
              "shadow-none !ring-0 !outline-none",
            ].join(" "),
            input: "text-sm text-text-primary placeholder:text-text-muted font-mono",
          }}
        />

        {/* Autocomplete dropdown */}
        {results.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-navy-800 border border-navy-600 rounded-xl shadow-2xl z-50 overflow-hidden">
            {results.map((r) => (
              <button
                key={r.ticker}
                disabled={adding === r.ticker}
                onClick={() => handleAdd(r.ticker)}
                className="w-full px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-navy-700 transition-colors disabled:opacity-50 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-gold-400 shrink-0">
                      {r.ticker}
                    </span>
                    <span className="text-xs text-text-secondary truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {r.sector && (
                      <span className="text-[10px] bg-navy-600 text-text-muted px-1.5 py-0.5 rounded-full">
                        {r.sector}
                      </span>
                    )}
                    {r.exchange && (
                      <span className="text-[10px] bg-navy-600 text-text-muted px-1.5 py-0.5 rounded-full">
                        {r.exchange}
                      </span>
                    )}
                    {r.quoteType === "ETF" && (
                      <span className="text-[10px] bg-navy-600 text-text-muted px-1.5 py-0.5 rounded-full">
                        ETF
                      </span>
                    )}
                    {r.diversifies && (
                      <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-1.5 py-0.5 rounded-full">
                        Diversifies
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {addError && <p className="mt-1.5 text-xs text-red-400">{addError}</p>}
      </div>

      {/* Filter + Sort bar */}
      {!loading && !error && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Filter chips */}
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  filter === f.key
                    ? "bg-gold-600/20 border-gold-600/40 text-gold-400"
                    : "bg-transparent border-navy-600 text-text-muted hover:border-navy-500 hover:text-text-secondary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-navy-800 border border-navy-600 text-text-secondary text-xs rounded-lg px-2 py-1 outline-none hover:border-navy-500 cursor-pointer"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div
          className="rounded-2xl overflow-hidden p-1"
          style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
        >
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-4 py-3 border-b border-navy-600 last:border-0">
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-14 rounded-md bg-navy-600" />
                <Skeleton className="h-2.5 w-28 rounded-md bg-navy-700" />
              </div>
              <Skeleton className="ml-auto h-3 w-16 rounded-md bg-navy-600" />
              <Skeleton className="h-3 w-20 rounded-md bg-navy-700" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl px-4 py-8 text-center text-sm text-red-400"
          style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}>
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl px-4 py-12 text-center"
          style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}>
          <p className="text-text-secondary text-sm">Your watchlist is empty.</p>
          <p className="text-text-muted text-xs mt-1">Search for a ticker above to get started.</p>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(10,22,40,0.8)", backdropFilter: "blur(12px)", border: "1px solid rgba(247,243,229,0.08)" }}
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-navy-600">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`bg-navy-800/80 text-text-muted text-[11px] uppercase tracking-wider font-medium py-2.5 px-4 ${col.className ?? ""}`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {applyFilterSort(items, filter, sort).map((item) => (
                <StockCard
                  key={item.ticker}
                  item={item}
                  onRemove={handleRemove}
                  removing={removing === item.ticker}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
