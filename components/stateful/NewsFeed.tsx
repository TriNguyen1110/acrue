"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Skeleton } from "@heroui/react";
import { SentimentBadge } from "@/components/ui/SentimentBadge";
import type { NewsArticle, PaginatedNews, Sentiment, ImpactLevel } from "@/types";
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

// ── Filter / Sort config ───────────────────────────────────────────────────────

type FilterKey = "all" | "positive" | "negative" | "high_impact";
type SortKey   = "newest" | "oldest" | "highest_impact" | "most_tickers";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",         label: "All"         },
  { key: "positive",    label: "Positive"    },
  { key: "negative",    label: "Negative"    },
  { key: "high_impact", label: "High Impact" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest",         label: "Newest"         },
  { key: "oldest",         label: "Oldest"         },
  { key: "highest_impact", label: "Highest Impact" },
  { key: "most_tickers",   label: "Most Tickers"   },
];

const IMPACT_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function applyFilterSort(
  articles:     NewsArticle[],
  filter:       FilterKey,
  sort:         SortKey,
  readIds:      Set<string>,
  tickerFilter: string
): NewsArticle[] {
  let out = [...articles];

  if (filter === "positive")         out = out.filter((a) => a.sentiment === "positive");
  if (filter === "negative")         out = out.filter((a) => a.sentiment === "negative");
  if (filter === "high_impact")      out = out.filter((a) => a.impact === "high");
  if (tickerFilter !== "__all__")    out = out.filter((a) => a.tickers.includes(tickerFilter));

  const compareFn = (a: NewsArticle, b: NewsArticle): number => {
    switch (sort) {
      case "oldest":
        return new Date(a.publishedAt ?? 0).getTime() - new Date(b.publishedAt ?? 0).getTime();
      case "highest_impact":
        return (IMPACT_RANK[a.impact ?? "low"] ?? 2) - (IMPACT_RANK[b.impact ?? "low"] ?? 2);
      case "most_tickers":
        return b.tickers.length - a.tickers.length;
      default: // newest
        return new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime();
    }
  };

  // Gmail-style: unread articles first, read articles last
  // Within each group, apply the active sort
  out.sort((a, b) => {
    const aRead = readIds.has(a.id);
    const bRead = readIds.has(b.id);
    if (aRead !== bRead) return aRead ? 1 : -1;
    return compareFn(a, b);
  });

  return out;
}

const MACRO_TOPICS: { key: string; label: string }[] = [
  { key: "fed",         label: "Fed"       },
  { key: "earnings",    label: "Earnings"  },
  { key: "inflation",   label: "Inflation" },
  { key: "oil",         label: "Oil"       },
  { key: "jobs",        label: "Jobs"      },
  { key: "crypto",      label: "Crypto"    },
];

// ── Impact chip ───────────────────────────────────────────────────────────────

function ImpactChip({ impact }: { impact: ImpactLevel | null }) {
  if (!impact) return null;

  const config: Record<ImpactLevel, { label: string; bg: string; text: string }> = {
    high:   { label: "High",   bg: "rgba(244,63,94,0.15)",  text: "text-rose-400"  },
    medium: { label: "Medium", bg: "rgba(245,158,11,0.15)", text: "text-amber-400" },
    low:    { label: "Low",    bg: "rgba(15,31,56,0.8)",    text: "text-text-muted" },
  };

  const cfg = config[impact];

  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${cfg.text}`}
      style={{ background: cfg.bg }}
    >
      {cfg.label}
    </span>
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
          className="flex items-start gap-4 px-4 py-4 border-b border-navy-600 last:border-0"
        >
          <div className="flex flex-col gap-1.5 shrink-0 mt-0.5">
            <Skeleton className="h-5 w-14 rounded-full bg-navy-600" />
            <Skeleton className="h-4 w-10 rounded-full bg-navy-700" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-3/4 rounded-md bg-navy-700" />
            <Skeleton className="h-3 w-1/3 rounded-md bg-navy-700" />
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Skeleton className="h-3 w-10 rounded-md bg-navy-700" />
            <Skeleton className="h-4 w-12 rounded-full bg-navy-700" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Article row ───────────────────────────────────────────────────────────────

interface ArticleRowProps {
  article:    NewsArticle;
  isExpanded: boolean;
  isRead:     boolean;
  onToggle:   (id: string) => void;
}

function ArticleRow({ article, isExpanded, isRead, onToggle }: ArticleRowProps) {
  return (
    <div
      className="border-b last:border-0 transition-all duration-300"
      style={{
        borderBottomColor: "rgba(247,243,229,0.06)",
        opacity: isRead ? 0.5 : 1,
      }}
    >
      {/* Summary row */}
      <div
        onClick={() => onToggle(article.id)}
        className="flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-navy-700/30 transition-colors"
        style={isRead ? { background: "rgba(5,13,26,0.4)" } : undefined}
      >
        {/* Left: sentiment + impact badges */}
        <div className="flex flex-col gap-1 shrink-0 mt-0.5 min-w-[60px]">
          <SentimentBadge sentiment={article.sentiment} size="sm" />
          <ImpactChip impact={article.impact} />
        </div>

        {/* Center: headline + source + time */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug line-clamp-2 ${isRead ? "text-text-secondary" : "text-text-primary"}`}>
            {article.headline}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {article.source && (
              <span className="text-[11px] text-text-muted">{article.source}</span>
            )}
            {article.publishedAt && (
              <>
                <span className="text-[11px] text-text-muted opacity-40">·</span>
                <span className="text-[11px] text-text-muted font-mono">
                  {timeAgo(article.publishedAt)}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: ticker pills + chevron */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
          {article.tickers.length > 0 && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] text-text-muted uppercase tracking-wider">Stocks</span>
              <div className="flex items-center gap-1 flex-wrap justify-end max-w-[100px]">
                {article.tickers.slice(0, 3).map((ticker) => (
                  <span
                    key={ticker}
                    className="font-mono text-[10px] text-gold-400 px-1.5 py-0.5 rounded"
                    style={{
                      background:  "rgba(247,243,229,0.07)",
                      borderColor: "rgba(247,243,229,0.12)",
                      border:      "1px solid rgba(247,243,229,0.12)",
                    }}
                  >
                    {ticker}
                  </span>
                ))}
                {article.tickers.length > 3 && (
                  <span className="text-[10px] text-text-muted font-mono">
                    +{article.tickers.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Expand/collapse chevron */}
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
            className={`text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded state */}
      {isExpanded && (
        <div
          className="px-4 pb-4 space-y-3"
          style={{ borderTop: "1px solid rgba(247,243,229,0.05)" }}
        >
          {/* Summary paragraph */}
          {article.summary && (
            <p className="text-xs text-text-secondary leading-relaxed pt-3">
              {article.summary}
            </p>
          )}

          {/* Insight block */}
          {article.insight && (
            <div
              className="pl-3 py-2 text-xs text-text-secondary italic"
              style={{ borderLeft: "2px solid rgba(247,243,229,0.2)" }}
            >
              {article.insight}
            </div>
          )}

          {/* Read full article link */}
          <a
            href={article.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-gold-400 hover:underline transition-colors"
          >
            Read full article
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}
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
        to see relevant news.
      </p>
    </div>
  );
}

function EmptyNoNews() {
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
      <p className="text-text-secondary text-sm mb-1">No news yet.</p>
      <p className="text-text-muted text-xs">Checking sources every 15 minutes.</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function NewsFeed() {
  const [articles, setArticles]         = useState<NewsArticle[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [hasWatchlist, setHasWatchlist]     = useState<boolean | null>(null);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);

  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]           = useState(0);

  const [filter, setFilter]             = useState<FilterKey>("all");
  const [topicFilter, setTopicFilter]   = useState<string>("__all__");
  const [tickerFilter, setTickerFilter] = useState<string>("__all__");
  const [sort, setSort]                 = useState<SortKey>("newest");

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [readIds, setReadIds]       = useState<Set<string>>(new Set());

  // Topics that actually appear in the current page
  const [presentTopics, setPresentTopics] = useState<Set<string>>(new Set());

  const LIMIT = 20;

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const loadArticles = useCallback(
    async (p: number, topic: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) });

        // Sentiment, impact, and ticker are filtered client-side — no server params needed
        if (topic !== "__all__") params.set("topic", topic);

        const res = await fetch(`/api/v1/news?${params}`);
        if (!res.ok) throw new Error();

        const data: PaginatedNews = await res.json();
        setArticles(data.articles);
        setTotal(data.total);
        setTotalPages(Math.max(1, Math.ceil(data.total / LIMIT)));

        // Seed read state from server-persisted read flags
        setReadIds((prev) => {
          const next = new Set(prev);
          for (const a of data.articles) {
            if (a.isRead) next.add(a.id);
          }
          return next;
        });

        // Derive which macro topics are present
        const topicSet = new Set<string>();
        for (const a of data.articles) {
          for (const t of a.topics ?? []) topicSet.add(t);
        }
        setPresentTopics(topicSet);
      } catch {
        setError("Could not load news.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Fetch watchlist on mount
  useEffect(() => {
    fetch("/api/v1/watchlist")
      .then((r) => r.json())
      .then((data: { ticker: string }[]) => {
        const tickers = Array.isArray(data) ? data.map((d) => d.ticker) : [];
        setHasWatchlist(tickers.length > 0);
        setWatchlistTickers(tickers);
      })
      .catch(() => setHasWatchlist(false));
  }, []);

  useEffect(() => {
    loadArticles(page, topicFilter);
  }, [page, topicFilter, loadArticles]);

  // Reset to page 1 when topic changes (server-side)
  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [topicFilter]);

  // ── Toggle expand ─────────────────────────────────────────────────────────────

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
    // Mark as read on first open — persist to DB + update local state
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      // Fire-and-forget — don't block the UI on the network call
      fetch(`/api/v1/news/${id}`, { method: "POST" }).catch(() => {/* silent */});
      return new Set(prev).add(id);
    });
  }

  // ── Derived data ──────────────────────────────────────────────────────────────

  const displayed     = applyFilterSort(articles, filter, sort, readIds, tickerFilter);
  const unreadCount   = displayed.filter((a) => !readIds.has(a.id)).length;
  const visibleTopics = MACRO_TOPICS.filter((t) => presentTopics.has(t.key));
  const isFiltered    = filter !== "all" || tickerFilter !== "__all__";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {!loading && !error && (isFiltered ? displayed.length : total) > 0 && (
            <span className="text-xs text-text-secondary">
              <span className="font-mono text-gold-400 font-medium">
                {isFiltered ? displayed.length : total}
              </span>{" "}
              {(isFiltered ? displayed.length : total) === 1 ? "article" : "articles"}
              {isFiltered && (
                <span className="text-text-muted"> matching</span>
              )}
            </span>
          )}
          {!loading && !error && unreadCount > 0 && (
            <span className="text-xs text-text-muted">
              <span className="font-mono text-emerald-400 font-medium">{unreadCount}</span> unread
            </span>
          )}
        </div>

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

      {/* Sentiment/impact filter chips */}
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

      {/* Topic chips — only shown when topics exist in current data */}
      {visibleTopics.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-text-muted uppercase tracking-wider shrink-0">Topic:</span>
          <button
            onClick={() => setTopicFilter("__all__")}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
              topicFilter === "__all__"
                ? "bg-navy-700 border-navy-500 text-text-secondary"
                : "bg-transparent border-navy-700 text-text-muted hover:border-navy-600 hover:text-text-secondary"
            }`}
          >
            All Topics
          </button>
          {visibleTopics.map((t) => (
            <button
              key={t.key}
              onClick={() => setTopicFilter(t.key)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors border ${
                topicFilter === t.key
                  ? "bg-navy-700 border-navy-500 text-text-secondary"
                  : "bg-transparent border-navy-700 text-text-muted hover:border-navy-600 hover:text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Ticker chips — one per watchlist ticker, always visible once watchlist is loaded */}
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

      {/* Feed */}
      {loading ? (
        <FeedSkeleton />
      ) : error ? (
        <EmptyNoNews />
      ) : hasWatchlist === false ? (
        <EmptyNoWatchlist />
      ) : displayed.length === 0 && isFiltered ? (
        <div
          className="rounded-2xl px-6 py-14 text-center"
          style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
        >
          <p className="text-text-secondary text-sm mb-1">No matching articles.</p>
          <p className="text-text-muted text-xs">Try a different filter or load the next page.</p>
        </div>
      ) : displayed.length === 0 ? (
        <EmptyNoNews />
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(10,22,40,0.8)", border: "1px solid rgba(247,243,229,0.08)" }}
        >
          {displayed.map((article) => (
            <ArticleRow
              key={article.id}
              article={article}
              isExpanded={expandedId === article.id}
              isRead={readIds.has(article.id)}
              onToggle={handleToggle}
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
  );
}
