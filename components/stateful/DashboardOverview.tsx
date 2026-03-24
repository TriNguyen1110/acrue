"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { WsServerMessage } from "@/hooks/useWebSocket";
import type { Alert } from "@/types/alerts";
import type { SignalScore } from "@/types/signals";
import type { WatchlistItem } from "@/types/watchlist";
import type { NewsArticle } from "@/types/news";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function pctColor(pct: number): string {
  if (pct > 0) return "#22c55e";
  if (pct < 0) return "#ef4444";
  return "#a0abbe";
}

function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(delta / 60_000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 65) return "#22c55e";
  if (score >= 50) return "#a3e635";
  if (score >= 35) return "#f59e0b";
  return "#ef4444";
}

function sentimentColor(s: string | null): string {
  if (s === "positive") return "#22c55e";
  if (s === "negative") return "#ef4444";
  return "#a0abbe";
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  title,
  href,
  badge,
  accent,
  children,
}: {
  title: string;
  href: string;
  badge?: number | string;
  accent?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    ref.current!.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    ref.current!.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className="rounded-2xl flex flex-col overflow-hidden spotlight glass glass-hover"
    >
      {/* Top accent bar */}
      <div
        className="h-[2px] w-full"
        style={{ background: accent ?? "linear-gradient(90deg, rgba(247,243,229,0.3), rgba(247,243,229,0.05) 70%, transparent)" }}
      />
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: "rgba(247,243,229,0.07)", position: "relative", zIndex: 1 }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm tracking-wide text-gold-500">{title}</span>
          {badge !== undefined && badge !== 0 && (
            <span
              className="min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold leading-none px-1"
              style={{ background: "#ef4444", color: "#fff", boxShadow: "0 0 10px rgba(239,68,68,0.6)" }}
            >
              {typeof badge === "number" && badge > 9 ? "9+" : badge}
            </span>
          )}
        </div>
        <Link
          href={href}
          className="text-[11px] text-text-muted hover:text-gold-400 transition-colors"
        >
          View all →
        </Link>
      </div>
      <div className="flex-1" style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-4 py-10 text-center text-xs text-text-muted">{text}</div>
  );
}

// ── Alerts card ───────────────────────────────────────────────────────────────

const SEVERITY_DOT: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#6b7280",
};

const SEVERITY_GLOW: Record<string, string> = {
  high:   "0 0 8px rgba(239,68,68,0.5)",
  medium: "0 0 8px rgba(245,158,11,0.5)",
  low:    "none",
};

function AlertsCard({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return <Empty text="No unread alerts" />;

  return (
    <div className="stagger-children">
      {alerts.map((a) => (
        <div
          key={a.id}
          className="row-hover flex items-center gap-3 px-4 py-3 border-b last:border-0"
          style={{ borderColor: "rgba(247,243,229,0.05)" }}
        >
          <span
            className="shrink-0 w-2 h-2 rounded-full"
            style={{
              background: SEVERITY_DOT[a.severity] ?? "#6b7280",
              boxShadow: SEVERITY_GLOW[a.severity] ?? "none",
            }}
          />
          <span className="font-mono text-xs font-bold text-gold-500 shrink-0 w-12">{a.ticker}</span>
          <span className="flex-1 min-w-0 text-xs text-text-secondary truncate">{a.message}</span>
          <span className="text-[10px] text-text-muted font-mono shrink-0">{timeAgo(a.triggeredAt)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Signals card ──────────────────────────────────────────────────────────────

function SignalsCard({ scores }: { scores: SignalScore[] }) {
  if (scores.length === 0) return <Empty text="No signals yet — add tickers to your watchlist" />;

  return (
    <div className="stagger-children">
      {scores.map((s) => (
        <div
          key={s.id}
          className="row-hover flex items-center gap-3 px-4 py-3 border-b last:border-0"
          style={{ borderColor: "rgba(247,243,229,0.05)" }}
        >
          <span className="font-mono text-xs font-bold text-gold-500 shrink-0 w-12">{s.ticker}</span>
          <div className="flex-1 min-w-0">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(15,31,56,0.8)", maxWidth: 90 }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${s.score}%`,
                  background: scoreColor(s.score),
                  boxShadow: `0 0 6px ${scoreColor(s.score)}80`,
                  transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
                }}
              />
            </div>
          </div>
          <span className="text-xs font-mono font-bold shrink-0" style={{ color: scoreColor(s.score) }}>
            {fmt(s.score, 0)}
          </span>
          <span
            className="text-[10px] font-semibold shrink-0 capitalize px-2 py-0.5 rounded-full"
            style={{
              color: s.direction === "bullish" ? "#22c55e" : "#ef4444",
              background: s.direction === "bullish" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            }}
          >
            {s.direction}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Movers card ───────────────────────────────────────────────────────────────

function MoversCard({ items }: { items: WatchlistItem[] }) {
  if (items.length === 0) return <Empty text="Your watchlist is empty" />;

  return (
    <div className="stagger-children">
      {items.map((item) => (
        <div
          key={item.id}
          className="row-hover flex items-center gap-3 px-4 py-3 border-b last:border-0"
          style={{ borderColor: "rgba(247,243,229,0.05)" }}
        >
          <span className="font-mono text-xs font-bold text-gold-500 shrink-0 w-12">{item.ticker}</span>
          <span className="flex-1 min-w-0 text-xs text-text-secondary font-mono truncate">
            ${fmt(item.quote.price)}
          </span>
          <span
            className="text-xs font-mono font-bold shrink-0 px-2 py-0.5 rounded-full"
            style={{
              color: pctColor(item.quote.changePct),
              background: item.quote.changePct > 0
                ? "rgba(34,197,94,0.12)"
                : item.quote.changePct < 0
                  ? "rgba(239,68,68,0.12)"
                  : "rgba(160,171,190,0.1)",
            }}
          >
            {item.quote.changePct >= 0 ? "+" : ""}{fmt(item.quote.changePct)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── News card ─────────────────────────────────────────────────────────────────

function NewsCard({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return <Empty text="No news available" />;

  return (
    <div className="stagger-children">
      {articles.map((a) => (
        <a
          key={a.id}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="row-hover block px-4 py-3 border-b last:border-0 group"
          style={{ borderColor: "rgba(247,243,229,0.05)" }}
        >
          <div className="flex items-start gap-2">
            <span
              className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full"
              style={{ background: sentimentColor(a.sentiment), boxShadow: `0 0 6px ${sentimentColor(a.sentiment)}80` }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-secondary group-hover:text-text-primary transition-colors leading-relaxed line-clamp-2">
                {a.headline}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                {a.tickers.length > 0 && (
                  <span className="text-[10px] font-mono font-bold text-gold-500">{a.tickers.slice(0, 3).join(", ")}</span>
                )}
                {a.source && (
                  <span className="text-[10px] text-text-muted">{a.source}</span>
                )}
                {a.publishedAt && (
                  <span className="text-[10px] text-text-muted">{timeAgo(a.publishedAt)}</span>
                )}
              </div>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-4 flex flex-col gap-2 glass glass-hover spotlight"
      style={{ cursor: "default" }}
    >
      <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-text-muted">{label}</span>
      <span
        className="text-2xl font-mono font-bold"
        style={{
          color: color ?? "#d4ccae",
          textShadow: color ? `0 0 16px ${color}60` : "0 0 16px rgba(212,204,174,0.3)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardOverview() {
  const [unreadAlerts,  setUnreadAlerts]  = useState<Alert[]>([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [signals,       setSignals]       = useState<SignalScore[]>([]);
  const [watchlist,     setWatchlist]     = useState<WatchlistItem[]>([]);
  const [news,          setNews]          = useState<NewsArticle[]>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [alertsRes, signalsRes, watchlistRes, newsRes] = await Promise.allSettled([
          fetch("/api/v1/alerts/unread").then((r) => r.json()),
          fetch("/api/v1/signals").then((r) => r.json()),
          fetch("/api/v1/watchlist").then((r) => r.json()),
          fetch("/api/v1/news?limit=5").then((r) => r.json()),
        ]);

        if (alertsRes.status === "fulfilled") {
          const d = alertsRes.value;
          setUnreadCount(typeof d.count === "number" ? d.count : 0);
          setUnreadAlerts(Array.isArray(d.alerts) ? d.alerts.slice(0, 4) : []);
        }
        if (signalsRes.status === "fulfilled" && Array.isArray(signalsRes.value.scores)) {
          const sorted = [...signalsRes.value.scores].sort((a: SignalScore, b: SignalScore) => b.score - a.score);
          setSignals(sorted.slice(0, 4));
        }
        if (watchlistRes.status === "fulfilled" && Array.isArray(watchlistRes.value)) {
          const sorted = [...watchlistRes.value].sort(
            (a: WatchlistItem, b: WatchlistItem) =>
              Math.abs(b.quote?.changePct ?? 0) - Math.abs(a.quote?.changePct ?? 0)
          );
          setWatchlist(sorted.slice(0, 4));
        }
        if (newsRes.status === "fulfilled" && Array.isArray(newsRes.value.articles)) {
          setNews(newsRes.value.articles.slice(0, 4));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Live updates via WebSocket — patch watchlist prices + increment alert badge
  useWebSocket(
    useCallback((msg: WsServerMessage) => {
      if (msg.type === "quote") {
        setWatchlist((prev) =>
          prev.map((item) =>
            item.ticker === msg.ticker
              ? { ...item, quote: { ...item.quote, price: msg.price, changePct: msg.changePct, volume: msg.volume } }
              : item
          )
        );
      } else if (msg.type === "alert") {
        setUnreadCount((n) => n + 1);
        const incoming: Alert = {
          id:          msg.id,
          ticker:      msg.ticker,
          type:        msg.alertType as Alert["type"],
          message:     msg.message,
          severity:    msg.severity as Alert["severity"],
          triggeredAt: msg.triggeredAt,
          read:        false,
          rules:       {},
        };
        setUnreadAlerts((prev) => [incoming, ...prev].slice(0, 4));
      }
    }, [])
  );

  const watchlistCount = watchlist.length;
  const topSignalScore = signals[0]?.score ?? null;
  const gainers = watchlist.filter((w) => (w.quote?.changePct ?? 0) > 0).length;
  const losers  = watchlist.filter((w) => (w.quote?.changePct ?? 0) < 0).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton rounded-2xl h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton rounded-2xl h-44" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stat pills row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill
          label="Unread Alerts"
          value={String(unreadCount)}
          color={unreadCount > 0 ? "#ef4444" : "#d4ccae"}
        />
        <StatPill
          label="Watchlist"
          value={watchlistCount > 0 ? `${watchlistCount} tickers` : "—"}
        />
        <StatPill
          label="Gainers / Losers"
          value={watchlistCount > 0 ? `${gainers} / ${losers}` : "—"}
          color={gainers >= losers ? "#22c55e" : "#ef4444"}
        />
        <StatPill
          label="Top Signal"
          value={topSignalScore !== null ? `${fmt(topSignalScore, 0)} / 100` : "—"}
          color={topSignalScore !== null ? scoreColor(topSignalScore) : undefined}
        />
      </div>

      {/* 2×2 grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section title="Unread Alerts" href="/alerts" badge={unreadCount}>
          <AlertsCard alerts={unreadAlerts} />
        </Section>

        <Section title="Top Signals" href="/signals">
          <SignalsCard scores={signals} />
        </Section>

        <Section title="Market Movers" href="/watchlist">
          <MoversCard items={watchlist} />
        </Section>

        <Section title="Latest News" href="/news">
          <NewsCard articles={news} />
        </Section>
      </div>
    </div>
  );
}
