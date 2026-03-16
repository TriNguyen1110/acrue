"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Spinner, Skeleton } from "@heroui/react";
import { AlertBadge, AlertTypeBadge } from "@/components/ui/AlertBadge";
import AlertRulesPanel from "@/components/stateful/AlertRulesPanel";
import type { Alert, AlertType, AlertSeverity, PaginatedAlerts } from "@/types";
import Link from "next/link";

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

const SEVERITY_BORDER: Record<AlertSeverity, string> = {
  high:   "border-l-2 border-rose-500",
  medium: "border-l-2 border-amber-500",
  low:    "",
};

// ── Filter / Sort config ───────────────────────────────────────────────────────

type FilterKey = "all" | AlertType | "high_priority";
type SortKey   = "newest" | "oldest" | "severity" | "ticker_az";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",          label: "All"         },
  { key: "price_change", label: "Price"       },
  { key: "volume_spike", label: "Volume"      },
  { key: "volatility",   label: "Volatility"  },
  { key: "rsi",          label: "RSI"         },
  { key: "ema_cross",    label: "EMA"         },
  { key: "high_priority",label: "High Priority" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest",    label: "Newest"    },
  { key: "oldest",    label: "Oldest"    },
  { key: "severity",  label: "Severity"  },
  { key: "ticker_az", label: "Ticker A–Z" },
];

const SEVERITY_RANK: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };

function capTierLabel(marketCap: number | undefined): string | null {
  if (!marketCap) return null;
  if (marketCap >= 200e9)  return ">$200B";
  if (marketCap >= 10e9)   return ">$10B";
  if (marketCap >= 2e9)    return ">$2B";
  if (marketCap >= 300e6)  return ">$300M";
  return "<$300M";
}

const CAP_TIER_ORDER = [">$200B", ">$10B", ">$2B", ">$300M", "<$300M"];

/** Derive available classification chips from the current alerts batch. */
function getClassificationChips(alerts: Alert[]): { key: string; label: string }[] {
  const sectors    = new Set<string>();
  const industries = new Set<string>();
  const capTiers   = new Set<string>();
  let hasEtf = false;

  for (const a of alerts) {
    if (a.sector)    sectors.add(a.sector);
    if (a.industry)  industries.add(a.industry);
    if (a.assetType && (a.assetType === "ETP" || a.assetType === "ETF")) hasEtf = true;
    const tier = capTierLabel(a.marketCap);
    if (tier) capTiers.add(tier);
  }

  const chips: { key: string; label: string }[] = [{ key: "__all__", label: "All Tickers" }];

  for (const s of [...sectors].sort()) chips.push({ key: `sector:${s}`, label: s });
  // Show industry only when it adds granularity beyond sector
  if (industries.size > sectors.size) {
    for (const ind of [...industries].sort()) chips.push({ key: `industry:${ind}`, label: ind });
  }
  // Cap tier chips in descending order
  for (const tier of CAP_TIER_ORDER.filter((t) => capTiers.has(t))) {
    chips.push({ key: `cap:${tier}`, label: `Cap ${tier}` });
  }
  if (hasEtf) chips.push({ key: "type:etf", label: "ETF / ETP" });

  return chips;
}

function applyFilterSort(
  alerts: Alert[],
  filter: FilterKey,
  classFilter: string,
  tickerFilter: string,
  sort: SortKey
): Alert[] {
  let out = [...alerts];

  // Ticker filter
  if (tickerFilter !== "__all__") {
    out = out.filter((a) => a.ticker === tickerFilter);
  }

  // Trigger-type filter
  if (filter === "high_priority") {
    out = out.filter((a) => a.severity === "high");
  } else if (filter !== "all") {
    out = out.filter((a) => a.type === filter);
  }

  // Ticker classification filter
  if (classFilter !== "__all__") {
    if (classFilter.startsWith("sector:")) {
      const v = classFilter.slice(7);
      out = out.filter((a) => a.sector === v);
    } else if (classFilter.startsWith("industry:")) {
      const v = classFilter.slice(9);
      out = out.filter((a) => a.industry === v);
    } else if (classFilter.startsWith("cap:")) {
      const tier = classFilter.slice(4);
      out = out.filter((a) => capTierLabel(a.marketCap) === tier);
    } else if (classFilter === "type:etf") {
      out = out.filter((a) => a.assetType === "ETP" || a.assetType === "ETF");
    }
  }

  out.sort((a, b) => {
    switch (sort) {
      case "oldest":    return new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime();
      case "severity":  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
      case "ticker_az": return a.ticker.localeCompare(b.ticker);
      default:          return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
    }
  });

  return out;
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
    >
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-3.5 border-b border-navy-600 last:border-0"
        >
          <Skeleton className="h-5 w-12 rounded-full bg-navy-600" />
          <Skeleton className="h-3 w-14 rounded-md bg-navy-700" />
          <Skeleton className="h-5 w-20 rounded-full bg-navy-600" />
          <Skeleton className="h-3 flex-1 rounded-md bg-navy-700" />
          <Skeleton className="h-3 w-16 rounded-md bg-navy-700" />
        </div>
      ))}
    </div>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────

interface AlertRowProps {
  alert: Alert;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onSelect: (ticker: string) => void;
}

function AlertRow({ alert, onMarkRead, onDismiss, onSelect }: AlertRowProps) {
  const [dismissing, setDismissing] = useState(false);

  function handleClick() {
    onMarkRead(alert.id);
    onSelect(alert.ticker);
  }

  async function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setDismissing(true);
    onDismiss(alert.id);
  }

  const unreadBg = !alert.read
    ? "rgba(15,31,56,0.55)"
    : "transparent";

  return (
    <div
      onClick={handleClick}
      className={`
        flex items-center gap-3 px-4 py-3 cursor-pointer group
        hover:bg-navy-700/40 transition-colors relative
        border-b last:border-0
        ${SEVERITY_BORDER[alert.severity]}
      `}
      style={{
        background: unreadBg,
        borderBottomColor: "rgba(247,243,229,0.06)",
      }}
    >
      {/* Severity */}
      <div className="shrink-0">
        <AlertBadge severity={alert.severity} size="sm" />
      </div>

      {/* Ticker */}
      <span
        className={`font-mono text-sm shrink-0 w-14 ${
          !alert.read ? "text-gold-400 font-semibold" : "text-text-secondary font-medium"
        }`}
      >
        {alert.ticker}
      </span>

      {/* Cause */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[9px] text-text-muted uppercase tracking-wider">via</span>
        <AlertTypeBadge type={alert.type} size="sm" />
      </div>

      {/* Message */}
      <p
        className={`flex-1 min-w-0 text-xs truncate ${
          !alert.read ? "text-text-primary" : "text-text-secondary"
        }`}
      >
        {alert.message}
      </p>

      {/* Time */}
      <span className="text-[11px] text-text-muted font-mono shrink-0">
        {timeAgo(alert.triggeredAt)}
      </span>

      {/* Dismiss (hover) */}
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all disabled:opacity-40"
        aria-label="Dismiss alert"
      >
        {dismissing ? (
          <Spinner size="sm" color="default" />
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ── Empty states ─────────────────────────────────────────────────────────────

function EmptyNoWatchlist() {
  return (
    <div
      className="rounded-2xl px-6 py-14 text-center"
      style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
    >
      <p className="text-text-secondary text-sm mb-1">Your watchlist is empty.</p>
      <p className="text-text-muted text-xs">
        <Link href="/watchlist" className="text-gold-400 hover:underline">
          Add tickers to your watchlist
        </Link>{" "}
        to start receiving alerts.
      </p>
    </div>
  );
}

function EmptyNoAlerts() {
  return (
    <div
      className="rounded-2xl px-6 py-14 text-center"
      style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
    >
      <div className="flex items-center justify-center gap-2 mb-3">
        {/* Subtle pulse indicator */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[11px] text-emerald-400 font-mono tracking-wide">Monitoring active</span>
      </div>
      <p className="text-text-secondary text-sm mb-1">No alerts yet.</p>
      <p className="text-text-muted text-xs">We monitor your watchlist every minute.</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AlertsFeed() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWatchlist, setHasWatchlist] = useState<boolean | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const [filter, setFilter]           = useState<FilterKey>("all");
  const [classFilter, setClassFilter] = useState<string>("__all__");
  const [tickerFilter, setTickerFilter] = useState<string>("__all__");
  const [sort, setSort]               = useState<SortKey>("newest");

  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);
  const [showTickerPicker, setShowTickerPicker] = useState(false);

  const LIMIT = 20;

  const loadAlerts = useCallback(async (p: number, f: FilterKey) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
      if (f !== "all" && f !== "high_priority") params.set("type", f);
      if (f === "high_priority") params.set("severity", "high");

      const res = await fetch(`/api/v1/alerts?${params}`);
      if (!res.ok) throw new Error();

      const data: PaginatedAlerts = await res.json();
      setAlerts(data.alerts);
      setTotalPages(Math.max(1, Math.ceil(data.total / LIMIT)));
      setUnreadCount(data.alerts.filter((a) => !a.read).length);
    } catch {
      setError("Could not load alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Check watchlist
  useEffect(() => {
    fetch("/api/v1/watchlist")
      .then((r) => r.json())
      .then((data: { ticker: string }[]) => {
        const has = Array.isArray(data) && data.length > 0;
        setHasWatchlist(has);
        if (has) setWatchlistTickers(data.map((d) => d.ticker));
      })
      .catch(() => setHasWatchlist(false));
  }, []);

  useEffect(() => {
    loadAlerts(page, filter);
  }, [page, filter, loadAlerts]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filter, classFilter, tickerFilter]);

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/api/v1/alerts/${id}/read`, { method: "PATCH" });
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, read: true } : a))
      );
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch {
      // silently fail
    }
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/v1/alerts/read-all", { method: "PATCH" });
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }

  async function handleDismiss(id: string) {
    try {
      await fetch(`/api/v1/alerts/${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silently fail
    }
  }

  const classChips = getClassificationChips(alerts);
  const displayed  = applyFilterSort(alerts, filter, classFilter, tickerFilter, sort);

  return (
    <>
      <div className="space-y-5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="text-xs text-text-secondary">
                <span className="font-mono text-gold-400 font-medium">{unreadCount}</span> unread
              </span>
            )}
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-text-muted hover:text-gold-400 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Manage Rules button */}
            {watchlistTickers.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowTickerPicker((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border"
                  style={{
                    background: "rgba(247,243,229,0.10)",
                    borderColor: "rgba(247,243,229,0.35)",
                    color: "#F7F3E5",
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Manage Rules
                </button>

                {showTickerPicker && (
                  <>
                    {/* click-away backdrop */}
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowTickerPicker(false)}
                    />
                    <div
                      className="absolute right-0 top-full mt-1.5 z-30 rounded-xl py-1.5 min-w-[130px]"
                      style={{
                        background: "rgba(10,22,40,0.98)",
                        border: "1px solid rgba(247,243,229,0.12)",
                        backdropFilter: "blur(12px)",
                      }}
                    >
                      <p className="px-3 py-1 text-[10px] text-text-muted uppercase tracking-wider">Select ticker</p>
                      {watchlistTickers.map((t) => (
                        <button
                          key={t}
                          onClick={() => {
                            setSelectedTicker(t);
                            setShowTickerPicker(false);
                          }}
                          className="w-full text-left px-3 py-1.5 text-xs font-mono text-text-secondary hover:text-gold-400 hover:bg-navy-700/50 transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Sort */}
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
        </div>

        {/* Trigger-type filter chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
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

        {/* Watchlist ticker chips — always visible once loaded */}
        {watchlistTickers.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-text-muted uppercase tracking-wider shrink-0">Ticker:</span>
            <button
              onClick={() => setTickerFilter("__all__")}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
                tickerFilter === "__all__"
                  ? "bg-navy-700 border-navy-500 text-text-secondary"
                  : "bg-transparent border-navy-700 text-text-muted hover:border-navy-600 hover:text-text-secondary"
              }`}
            >
              All
            </button>
            {watchlistTickers.map((t) => (
              <button
                key={t}
                onClick={() => setTickerFilter(t)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium transition-colors border ${
                  tickerFilter === t
                    ? "bg-gold-600/20 border-gold-600/40 text-gold-400"
                    : "bg-transparent border-navy-700 text-text-muted hover:border-navy-600 hover:text-text-secondary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Classification chips — sector / cap tier / ETF */}
        {classChips.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-text-muted uppercase tracking-wider shrink-0">Ticker:</span>
            {classChips.map((c) => (
              <button
                key={c.key}
                onClick={() => setClassFilter(c.key)}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
                  classFilter === c.key
                    ? "bg-navy-700 border-navy-500 text-text-secondary"
                    : "bg-transparent border-navy-700 text-text-muted hover:border-navy-600 hover:text-text-secondary"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Feed */}
        {loading ? (
          <FeedSkeleton />
        ) : error ? (
          <div
            className="rounded-2xl px-4 py-8 text-center text-sm text-red-400"
            style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
          >
            {error}
          </div>
        ) : hasWatchlist === false ? (
          <EmptyNoWatchlist />
        ) : displayed.length === 0 ? (
          <EmptyNoAlerts />
        ) : (
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
          >
            {displayed.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onMarkRead={handleMarkRead}
                onDismiss={handleDismiss}
                onSelect={setSelectedTicker}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-center gap-3">
            <Button
              size="sm"
              variant="flat"
              isDisabled={page <= 1}
              onPress={() => setPage((p) => p - 1)}
              className="h-7 text-xs bg-navy-800 border border-navy-600 text-text-secondary hover:border-navy-500"
            >
              ← Prev
            </Button>
            <span className="text-xs text-text-muted font-mono">
              Page {page} of {totalPages}
            </span>
            <Button
              size="sm"
              variant="flat"
              isDisabled={page >= totalPages}
              onPress={() => setPage((p) => p + 1)}
              className="h-7 text-xs bg-navy-800 border border-navy-600 text-text-secondary hover:border-navy-500"
            >
              Next →
            </Button>
          </div>
        )}
      </div>

      {/* Rules panel */}
      <AlertRulesPanel
        ticker={selectedTicker}
        onClose={() => setSelectedTicker(null)}
      />
    </>
  );
}
