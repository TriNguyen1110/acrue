"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Spinner, Skeleton } from "@heroui/react";
import { AlertBadge, AlertTypeBadge } from "@/components/ui/AlertBadge";
import AlertRulesPanel from "@/components/stateful/AlertRulesPanel";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { WsServerMessage } from "@/hooks/useWebSocket";
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

const SEVERITY_RANK: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };

type SortKey = "newest" | "oldest" | "severity" | "ticker_az";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest",    label: "Newest"    },
  { key: "oldest",    label: "Oldest"    },
  { key: "severity",  label: "Severity"  },
  { key: "ticker_az", label: "Ticker A–Z" },
];

// ── Filter options from API ───────────────────────────────────────────────────

interface AlertFilterOptions {
  tickers:    string[];
  sectors:    string[];
  industries: string[];
  capTiers:   string[];
  hasEtf:     boolean;
}

// ── Active filters state ──────────────────────────────────────────────────────

interface ActiveFilters {
  types:      Set<AlertType>;
  severities: Set<AlertSeverity>;
  tickers:    Set<string>;
  sectors:    Set<string>;
  capTiers:   Set<string>;
  topics:     Set<string>;
  etfOnly:    boolean;
}

function emptyFilters(): ActiveFilters {
  return {
    types:      new Set(),
    severities: new Set(),
    tickers:    new Set(),
    sectors:    new Set(),
    capTiers:   new Set(),
    topics:     new Set(),
    etfOnly:    false,
  };
}

function hasActiveFilters(f: ActiveFilters): boolean {
  return (
    f.types.size > 0 ||
    f.severities.size > 0 ||
    f.tickers.size > 0 ||
    f.sectors.size > 0 ||
    f.capTiers.size > 0 ||
    f.topics.size > 0 ||
    f.etfOnly
  );
}

function applyFiltersSort(
  alerts: Alert[],
  filters: ActiveFilters,
  sort: SortKey,
): Alert[] {
  let out = [...alerts];

  if (filters.types.size > 0)      out = out.filter((a) => filters.types.has(a.type));
  if (filters.severities.size > 0) out = out.filter((a) => filters.severities.has(a.severity));
  if (filters.tickers.size > 0)    out = out.filter((a) => filters.tickers.has(a.ticker));
  if (filters.sectors.size > 0)    out = out.filter((a) => !!a.sector && filters.sectors.has(a.sector));
  if (filters.capTiers.size > 0) {
    out = out.filter((a) => {
      if (!a.marketCap) return false;
      const tier = capTierLabel(a.marketCap);
      return filters.capTiers.has(tier);
    });
  }
  if (filters.topics.size > 0) {
    out = out.filter((a) => !!a.industry && filters.topics.has(a.industry));
  }
  if (filters.etfOnly) out = out.filter((a) => a.assetType === "ETP" || a.assetType === "ETF");

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

function capTierLabel(marketCap: number): string {
  if (marketCap >= 200e9)  return ">$200B";
  if (marketCap >= 10e9)   return ">$10B";
  if (marketCap >= 2e9)    return ">$2B";
  if (marketCap >= 300e6)  return ">$300M";
  return "<$300M";
}

// ── Toggle helpers ────────────────────────────────────────────────────────────

function toggleSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const ALERT_TYPES: { key: AlertType; label: string }[] = [
  { key: "price_change", label: "Price Change" },
  { key: "volatility",   label: "Volatility"   },
  { key: "price_level",  label: "Price Level"  },
  { key: "volume_spike", label: "Volume Spike" },
  { key: "rsi",          label: "RSI"          },
  { key: "ema_cross",    label: "EMA Cross"    },
];

const SEVERITIES: { key: AlertSeverity; label: string; color: string }[] = [
  { key: "high",   label: "High",   color: "text-rose-400  border-rose-500/40  bg-rose-500/10"  },
  { key: "medium", label: "Medium", color: "text-amber-400 border-amber-500/40 bg-amber-500/10" },
  { key: "low",    label: "Low",    color: "text-text-muted border-navy-600    bg-transparent"  },
];

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  colorClass?: string;
}

function FilterChip({ label, active, onClick, colorClass }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap ${
        active
          ? colorClass ?? "bg-gold-600/20 border-gold-600/40 text-gold-400"
          : "bg-transparent border-navy-700 text-text-muted hover:border-navy-500 hover:text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

interface FilterPanelProps {
  options:  AlertFilterOptions;
  filters:  ActiveFilters;
  onChange: (f: ActiveFilters) => void;
  onClear:  () => void;
}

function GroupBtn({ name, activeCount, openGroup, onToggle }: {
  name: string;
  activeCount: number;
  openGroup: string | null;
  onToggle: (name: string) => void;
}) {
  const isOpen    = openGroup === name;
  const hasActive = activeCount > 0;
  return (
    <button
      onClick={() => onToggle(name)}
      className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-widest border transition-all ${
        hasActive
          ? "text-gold-400 border-gold-600/30 bg-gold-600/10"
          : isOpen
            ? "text-text-secondary border-navy-500 bg-navy-700/60"
            : "text-text-muted border-navy-700 hover:border-navy-500 hover:text-text-secondary"
      }`}
    >
      {name}
      {hasActive && (
        <span className="flex items-center justify-center h-3.5 w-3.5 rounded-full bg-gold-600/30 text-[9px] font-bold text-gold-400 leading-none">
          {activeCount}
        </span>
      )}
      <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  );
}

function FilterPanel({ options, filters, onChange, onClear }: FilterPanelProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const active = hasActiveFilters(filters);

  function toggle<K extends "types" | "severities" | "tickers" | "sectors" | "capTiers" | "topics">(
    key: K,
      value: unknown
  ) {
    onChange({ ...filters, [key]: toggleSet(filters[key], value) });
  }

  function toggleGroup(name: string) {
    setOpenGroup((prev) => (prev === name ? null : name));
  }

  const sep = <span className="shrink-0 w-px h-4 bg-navy-600" />;

  // Chips rendered below the label row for the open group
  const chipRows: Record<string, React.ReactNode> = {
    Type: ALERT_TYPES.map((t) => (
      <FilterChip key={t.key} label={t.label} active={filters.types.has(t.key)} onClick={() => toggle("types", t.key)} />
    )),
    Severity: SEVERITIES.map((s) => (
      <FilterChip key={s.key} label={s.label} active={filters.severities.has(s.key)} onClick={() => toggle("severities", s.key)} colorClass={s.color} />
    )),
    Ticker: options.tickers.map((t) => (
      <FilterChip key={t} label={t} active={filters.tickers.has(t)} onClick={() => toggle("tickers", t)} colorClass="bg-gold-600/20 border-gold-600/40 text-gold-400 font-mono" />
    )),
    Sector: options.sectors.map((s) => (
      <FilterChip key={s} label={s} active={filters.sectors.has(s)} onClick={() => toggle("sectors", s)} />
    )),
    Cap: options.capTiers.map((tier) => (
      <FilterChip key={tier} label={tier} active={filters.capTiers.has(tier)} onClick={() => toggle("capTiers", tier)} />
    )),
    Topic: options.industries.map((ind) => (
      <FilterChip key={ind} label={ind} active={filters.topics.has(ind)} onClick={() => toggle("topics", ind)} />
    )),
  };

  return (
    <div
      className="rounded-xl mb-4 overflow-hidden"
      style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
    >
      {/* Label row */}
      <div
        className="px-3 py-2 flex items-center gap-2 flex-wrap"
        style={openGroup ? { borderBottom: "1px solid rgba(247,243,229,0.06)" } : undefined}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted shrink-0">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>

        <GroupBtn name="Type"     activeCount={filters.types.size}      openGroup={openGroup} onToggle={toggleGroup} />
        {sep}
        <GroupBtn name="Severity" activeCount={filters.severities.size}  openGroup={openGroup} onToggle={toggleGroup} />
        {options.tickers.length  > 0 && <>{sep}<GroupBtn name="Ticker" activeCount={filters.tickers.size}  openGroup={openGroup} onToggle={toggleGroup} /></>}
        {options.sectors.length  > 0 && <>{sep}<GroupBtn name="Sector" activeCount={filters.sectors.size}  openGroup={openGroup} onToggle={toggleGroup} /></>}
        {options.capTiers.length > 0 && <>{sep}<GroupBtn name="Cap"    activeCount={filters.capTiers.size} openGroup={openGroup} onToggle={toggleGroup} /></>}
        {options.industries.length > 0 && <>{sep}<GroupBtn name="Topic" activeCount={filters.topics.size}  openGroup={openGroup} onToggle={toggleGroup} /></>}
        {options.hasEtf && (
          <>{sep}<FilterChip label="ETF / ETP" active={filters.etfOnly} onClick={() => onChange({ ...filters, etfOnly: !filters.etfOnly })} /></>
        )}
        {active && (
          <>{sep}
            <button onClick={onClear} className="text-[10px] text-text-muted hover:text-gold-400 transition-colors whitespace-nowrap">
              Clear all
            </button>
          </>
        )}
      </div>

      {/* Chips row — below labels, only for the open group */}
      {openGroup && chipRows[openGroup] && (
        <div className="px-3 py-2.5 flex flex-wrap gap-1.5">
          {chipRows[openGroup]}
        </div>
      )}
    </div>
  );
}

// ── Active filter chips bar ───────────────────────────────────────────────────

interface ActiveChipsProps {
  filters:  ActiveFilters;
  onChange: (f: ActiveFilters) => void;
}

function ActiveChips({ filters, onChange }: ActiveChipsProps) {
  if (!hasActiveFilters(filters)) return null;

  const chips: { label: string; onRemove: () => void }[] = [];

  for (const t of filters.types)      chips.push({ label: t.replace("_", " "),   onRemove: () => onChange({ ...filters, types: toggleSet(filters.types, t) }) });
  for (const s of filters.severities) chips.push({ label: s,                      onRemove: () => onChange({ ...filters, severities: toggleSet(filters.severities, s) }) });
  for (const t of filters.tickers)    chips.push({ label: t,                      onRemove: () => onChange({ ...filters, tickers: toggleSet(filters.tickers, t) }) });
  for (const s of filters.sectors)    chips.push({ label: s,                      onRemove: () => onChange({ ...filters, sectors: toggleSet(filters.sectors, s) }) });
  for (const c of filters.capTiers)   chips.push({ label: `Cap ${c}`,             onRemove: () => onChange({ ...filters, capTiers: toggleSet(filters.capTiers, c) }) });
  for (const tp of filters.topics)    chips.push({ label: tp,                     onRemove: () => onChange({ ...filters, topics: toggleSet(filters.topics, tp) }) });
  if (filters.etfOnly)                chips.push({ label: "ETF / ETP",            onRemove: () => onChange({ ...filters, etfOnly: false }) });

  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-3">
      <span className="text-[10px] text-text-muted uppercase tracking-wider">Active:</span>
      {chips.map((c, i) => (
        <span
          key={i}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-navy-700 border-navy-500 text-text-secondary"
        >
          {c.label}
          <button
            onClick={c.onRemove}
            className="ml-0.5 text-text-muted hover:text-red-400 transition-colors leading-none"
            aria-label={`Remove ${c.label} filter`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
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
  onDismiss:  (id: string) => void;
  onSelect:   (ticker: string) => void;
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

  const unreadBg = !alert.read ? "rgba(15,31,56,0.55)" : "transparent";

  return (
    <div
      onClick={handleClick}
      className={`
        flex items-center gap-3 px-4 py-3 cursor-pointer group
        hover:bg-navy-700/40 transition-colors relative
        border-b last:border-0
        ${SEVERITY_BORDER[alert.severity]}
      `}
      style={{ background: unreadBg, borderBottomColor: "rgba(247,243,229,0.06)" }}
    >
      <div className="shrink-0">
        <AlertBadge severity={alert.severity} size="sm" />
      </div>
      <span
        className={`font-mono text-sm shrink-0 w-14 ${
          !alert.read ? "text-gold-400 font-semibold" : "text-text-secondary font-medium"
        }`}
      >
        {alert.ticker}
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[9px] text-text-muted uppercase tracking-wider">via</span>
        <AlertTypeBadge type={alert.type} size="sm" />
      </div>
      <p
        className={`flex-1 min-w-0 text-xs truncate ${
          !alert.read ? "text-text-primary" : "text-text-secondary"
        }`}
      >
        {alert.message}
      </p>
      <span className="text-[11px] text-text-muted font-mono shrink-0">
        {timeAgo(alert.triggeredAt)}
      </span>
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

// ── Empty states ──────────────────────────────────────────────────────────────

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
  const [alerts,       setAlerts]       = useState<Alert[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [hasWatchlist, setHasWatchlist] = useState<boolean | null>(null);

  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);

  const [sort,    setSort]    = useState<SortKey>("newest");
  const [filters, setFilters] = useState<ActiveFilters>(emptyFilters);

  const [filterOptions, setFilterOptions] = useState<AlertFilterOptions>({
    tickers: [], sectors: [], industries: [], capTiers: [], hasEtf: false,
  });

  const [selectedTicker,    setSelectedTicker]    = useState<string | null>(null);
  const [watchlistTickers,  setWatchlistTickers]  = useState<string[]>([]);
  const [showTickerPicker,  setShowTickerPicker]  = useState(false);

  const LIMIT = 20;

  const loadAlerts = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });
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

  // Load filter options once (full history, not paginated)
  useEffect(() => {
    fetch("/api/v1/alerts/filters")
      .then((r) => r.json())
      .then((d: AlertFilterOptions) => setFilterOptions(d))
      .catch(() => {});
  }, []);

  // Load watchlist for "Manage Rules"
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
    loadAlerts(page);
  }, [page, loadAlerts]);

  // Reset page on filter/sort change
  useEffect(() => { setPage(1); }, [filters, sort]);

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/api/v1/alerts/${id}/read`, { method: "PATCH" });
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
      setUnreadCount((n) => Math.max(0, n - 1));
    } catch { /* silent */ }
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/v1/alerts/read-all", { method: "PATCH" });
      setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }

  async function handleDismiss(id: string) {
    try {
      await fetch(`/api/v1/alerts/${id}`, { method: "DELETE" });
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch { /* silent */ }
  }

  // Real-time alert stream — prepend new alerts to page 1 as they fire
  useWebSocket(
    useCallback((msg: WsServerMessage) => {
      if (msg.type !== "alert") return;
      // Only prepend on page 1 so the ordering stays coherent
      if (page !== 1) return;
      const incoming: Alert = {
        id:          msg.id,
        ticker:      msg.ticker,
        type:        msg.alertType as AlertType,
        message:     msg.message,
        severity:    msg.severity as AlertSeverity,
        triggeredAt: msg.triggeredAt,
        read:        false,
        rules:       {},
      };
      setAlerts((prev) => {
        // Avoid duplicates in case the REST poll and WS race
        if (prev.some((a) => a.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
      setUnreadCount((n) => n + 1);
    }, [page])
  );

  const displayed = applyFiltersSort(alerts, filters, sort);

  return (
    <>
      <div className="space-y-4">

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

            {/* Manage Rules */}
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
                    <div className="fixed inset-0 z-20" onClick={() => setShowTickerPicker(false)} />
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
                          onClick={() => { setSelectedTicker(t); setShowTickerPicker(false); }}
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

        {/* Filter bar */}
        <FilterPanel
          options={filterOptions}
          filters={filters}
          onChange={setFilters}
          onClear={() => setFilters(emptyFilters())}
        />

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
