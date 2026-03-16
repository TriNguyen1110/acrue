import Sentiment from "sentiment";
import Parser from "rss-parser";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCompanyNews } from "@/lib/finnhub/news";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NewsArticleDTO {
  id:             string;
  url:            string;
  tickers:        string[];
  topics:         string[];
  headline:       string;
  summary:        string | null;
  sentiment:      "positive" | "neutral" | "negative" | null;
  sentimentScore: number | null;
  impact:         "low" | "medium" | "high" | null;
  source:         string | null;
  publishedAt:    string | null; // ISO
  insight:        string | null;
  createdAt:      string;        // ISO
  isRead:         boolean;
}

export interface NewsFilters {
  ticker?:    string;
  topic?:     string;
  sentiment?: string;
  page?:      number;
  limit?:     number;
}

// ── NLP setup ─────────────────────────────────────────────────────────────────

const sentimentAnalyzer = new Sentiment();

const TOPIC_KEYWORDS: Record<string, string[]> = {
  fed:         ["federal reserve", "fed ", "fomc", "powell", "interest rate", "rate hike", "rate cut"],
  inflation:   ["inflation", "cpi", "pce", "price index", "deflation"],
  earnings:    ["earnings", "revenue", "eps", "quarterly results", "beat", "miss", "guidance"],
  oil:         ["oil", "crude", "opec", "energy prices", "brent", "wti"],
  jobs:        ["jobs", "unemployment", "nonfarm", "payroll", "labor market"],
  geopolitics: ["tariff", "sanctions", "war", "trade war", "geopolitical"],
  crypto:      ["bitcoin", "crypto", "ethereum", "blockchain", "defi"],
  housing:     ["housing", "mortgage", "real estate", "home prices", "rent"],
};

const RSS_FEEDS = [
  // AP Business — wire service, no paywall, reliable RSS
  { url: "https://feeds.apnews.com/rss/apf-business",                            source: "AP"           },
  // CNBC Markets
  { url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",                  source: "CNBC"         },
  // MarketWatch Top Stories
  { url: "https://feeds.marketwatch.com/marketwatch/topstories/",                 source: "MarketWatch"  },
  // Yahoo Finance Top Financial Stories
  { url: "https://finance.yahoo.com/rss/topfinstories",                           source: "Yahoo Finance" },
];

/**
 * Allowlist of trusted outlets for Finnhub company-news ingest.
 * Finnhub aggregates from hundreds of sources; this keeps only major,
 * established financial publications and wire services.
 */
const TRUSTED_SOURCES = new Set([
  "reuters",
  "bloomberg",
  "cnbc",
  "marketwatch",
  "wsj",
  "the wall street journal",
  "financial times",
  "ft",
  "ap",
  "associated press",
  "barron's",
  "barrons",
  "seeking alpha",
  "yahoo finance",
  "investing.com",
  "benzinga",
  "the motley fool",
  "motley fool",
  "business insider",
  "forbes",
  "fortune",
]);

// ── Module-level ticker map (loaded once, lazily) ─────────────────────────────

interface AssetRef { ticker: string; name: string }
let assetCache: AssetRef[] | null = null;

async function getAssets(): Promise<AssetRef[]> {
  if (assetCache) return assetCache;
  try {
    assetCache = await prisma.asset.findMany({ select: { ticker: true, name: true } });
  } catch (e) {
    assetCache = null; // reset so the next call retries
    throw e;
  }
  return assetCache;
}

// ── NLP helpers ───────────────────────────────────────────────────────────────

/**
 * Scores sentiment on combined headline + summary text.
 *
 * Normalises the raw AFINN score by word count and maps it to a 0–1 scale:
 *   raw / (wordCount * 5)   → clamped to [-1, 1]
 *   (clamped + 1) / 2       → mapped to  [0, 1]
 *
 * Thresholds:
 *   < 0.4  → negative
 *   0.4–0.6 → neutral
 *   > 0.6  → positive
 */
function scoreSentiment(
  headline: string,
  summary: string | null
): { score: number; label: "positive" | "neutral" | "negative" } {
  const text     = `${headline} ${summary ?? ""}`.trim();
  const result   = sentimentAnalyzer.analyze(text);
  const words    = result.tokens.length;
  const raw      = words > 0 ? result.score / (words * 5) : 0;
  const clamped  = Math.max(-1, Math.min(1, raw));
  const score    = (clamped + 1) / 2; // map to [0, 1]

  const label: "positive" | "neutral" | "negative" =
    score < 0.4 ? "negative" : score > 0.6 ? "positive" : "neutral";

  return { score, label };
}

/**
 * Extracts ticker symbols mentioned in article text.
 *
 * Two passes:
 *   1. Exact uppercase ticker token match (e.g. "AAPL")  → high confidence
 *   2. Company name substring match (e.g. "Apple")       → medium confidence
 *
 * Returns a deduplicated sorted array of matched ticker strings.
 */
async function extractTickers(text: string): Promise<string[]> {
  let assets: AssetRef[];
  try {
    assets = await getAssets();
  } catch {
    // Asset lookup failure is non-fatal — ingest the article without ticker tags
    return [];
  }
  const lower  = text.toLowerCase();
  const found  = new Set<string>();

  for (const asset of assets) {
    const t = asset.ticker;

    // Require at least 2-char tickers to avoid false positives on single letters
    if (t.length < 2) continue;

    // Exact ticker match — must be a standalone word (word boundary on both sides)
    // e.g. "AAPL" matches but "APPLIED" does not match ticker "A"
    const tickerRegex = new RegExp(`(?<![A-Z])${t}(?![A-Z])`, "");
    if (tickerRegex.test(text)) {
      found.add(t);
      continue;
    }

    // Company name match — name must be at least 5 chars to avoid noise
    if (asset.name.length >= 5 && lower.includes(asset.name.toLowerCase())) {
      found.add(t);
    }
  }

  return [...found].sort();
}

/**
 * Tags article text with macro topic labels based on keyword matching.
 */
function tagTopics(text: string): string[] {
  const lower  = text.toLowerCase();
  const topics: string[] = [];

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      topics.push(topic);
    }
  }

  return topics;
}

/**
 * Derives an impact level from the sentiment score.
 *   High:   strong signal (score > 0.75 or < 0.25)
 *   Medium: moderate signal (0.6–0.75 or 0.25–0.4)
 *   Low:    neutral zone (0.4–0.6)
 */
function scoreImpact(sentimentScore: number): "low" | "medium" | "high" {
  if (sentimentScore > 0.75 || sentimentScore < 0.25) return "high";
  if (sentimentScore > 0.6  || sentimentScore < 0.4)  return "medium";
  return "low";
}

/**
 * Generates a one-line human-readable insight from NLP outputs.
 */
function generateInsight(
  sentiment: "positive" | "neutral" | "negative",
  impact:    "low" | "medium" | "high",
  tickers:   string[],
  topics:    string[],
  source:    string | null
): string {
  const src = source ?? "Unknown";

  if (tickers.length > 0) {
    if (sentiment === "positive" && impact === "high") {
      return `${tickers[0]} showing strong bullish signal — ${src} reports positive developments`;
    }
    if (sentiment === "negative" && impact === "high") {
      return `${tickers[0]} faces selling pressure — ${src} reports negative developments`;
    }
  }

  if (topics.length > 0 && tickers.length === 0) {
    return `Macro: ${topics.join(", ")} — ${sentiment} market signal from ${src}`;
  }

  return `Market activity detected — monitor ${tickers[0] ?? "watchlist"} for impact`;
}

// ── Shared ingest pipeline ─────────────────────────────────────────────────────

interface RawArticle {
  url:         string;
  headline:    string;
  summary:     string | null;
  source:      string | null;
  publishedAt: Date | null;
}

/**
 * Runs the full NLP pipeline on a raw article and upserts it into the DB.
 * Returns 1 if the row was newly created, 0 if it was an update.
 */
async function processAndUpsert(raw: RawArticle): Promise<number> {
  const text     = `${raw.headline} ${raw.summary ?? ""}`;
  const [tickers, topics, { score, label }] = await Promise.all([
    extractTickers(text),
    Promise.resolve(tagTopics(text)),
    Promise.resolve(scoreSentiment(raw.headline, raw.summary)),
  ]);

  const impact  = scoreImpact(score);
  const insight = generateInsight(label, impact, tickers, topics, raw.source);

  // Check if it already exists before upsert so we can return the right count
  const existing = await prisma.newsArticle.findUnique({
    where:  { url: raw.url },
    select: { id: true },
  });

  await prisma.newsArticle.upsert({
    where:  { url: raw.url },
    create: {
      url:            raw.url,
      tickers,
      topics,
      headline:       raw.headline,
      summary:        raw.summary,
      sentiment:      label,
      sentimentScore: score,
      impact,
      source:         raw.source,
      publishedAt:    raw.publishedAt,
      insight,
    },
    update: {
      tickers,
      topics,
      headline:       raw.headline,
      summary:        raw.summary,
      sentiment:      label,
      sentimentScore: score,
      impact,
      source:         raw.source,
      publishedAt:    raw.publishedAt,
      insight,
    },
  });

  return existing ? 0 : 1;
}

// ── Ingest functions ───────────────────────────────────────────────────────────

/**
 * Pulls company news for a single ticker from Finnhub, runs the NLP pipeline,
 * and upserts all articles into the DB.
 *
 * Returns the count of articles that were newly created (not updated).
 */
export async function ingestCompanyNews(ticker: string): Promise<number> {
  const items = await getCompanyNews(ticker);
  if (items.length === 0) return 0;

  let created = 0;
  for (const item of items) {
    if (!item.url || !item.headline) continue;

    // Skip low-quality or unknown outlets
    const sourceLower = (item.source ?? "").toLowerCase();
    if (sourceLower && !TRUSTED_SOURCES.has(sourceLower)) continue;

    try {
      created += await processAndUpsert({
        url:         item.url,
        headline:    item.headline,
        summary:     item.summary ?? null,
        source:      item.source  ?? null,
        publishedAt: item.datetime ? new Date(item.datetime * 1000) : null,
      });
    } catch (e) {
      console.error(`[news] failed to ingest article "${item.headline}":`, e);
    }
  }

  return created;
}

/**
 * Fetches all configured RSS feeds, runs the NLP pipeline on each item,
 * and upserts into the DB.
 *
 * Returns the count of articles that were newly created.
 */
export async function ingestRssFeeds(): Promise<number> {
  const parser = new Parser({ timeout: 10_000 });
  let created  = 0;

  for (const feed of RSS_FEEDS) {
    let output: Awaited<ReturnType<typeof parser.parseURL>>;
    try {
      output = await parser.parseURL(feed.url);
    } catch (e) {
      console.error(`[news] RSS fetch failed for ${feed.source}:`, e);
      continue;
    }

    for (const item of output.items) {
      const url      = item.link;
      const headline = item.title;
      if (!url || !headline) continue;

      try {
        created += await processAndUpsert({
          url,
          headline,
          summary:     item.contentSnippet ?? null,
          source:      feed.source,
          publishedAt: item.isoDate ? new Date(item.isoDate) : null,
        });
      } catch (e) {
        console.error(`[news] failed to ingest RSS item "${headline}":`, e);
      }
    }
  }

  return created;
}

// ── Query functions ────────────────────────────────────────────────────────────

/**
 * Returns paginated news relevant to a user.
 *
 * Relevance = the article mentions at least one ticker in the user's watchlist
 *             OR the article has at least one macro topic tag (relevant to anyone).
 *
 * Filters for ticker, topic, and sentiment are additive (AND logic).
 */
export async function getNewsForUser(
  userId:  string,
  filters: NewsFilters = {}
): Promise<{ articles: NewsArticleDTO[]; total: number }> {
  const { ticker, topic, sentiment, page = 1, limit = 20 } = filters;
  const skip = (page - 1) * limit;

  // Resolve user's watchlist tickers
  const watchlistRows = await prisma.watchlist.findMany({
    where:  { userId },
    select: { ticker: true },
  });
  const userTickers = watchlistRows.map((w) => w.ticker);

  // All macro topic keys — used to gate "macro article" relevance
  const ALL_TOPICS = ["fed", "inflation", "earnings", "oil", "jobs", "geopolitics", "crypto", "housing"];

  // Build Prisma where clause
  // Relevance gate: at least one watchlist ticker OR at least one recognised macro topic
  const relevanceOR: Prisma.NewsArticleWhereInput[] = [
    ...(userTickers.length > 0
      ? [{ tickers: { hasSome: userTickers } } satisfies Prisma.NewsArticleWhereInput]
      : []),
    { topics: { hasSome: ALL_TOPICS } },
  ];

  const andClauses: Prisma.NewsArticleWhereInput[] = [
    { OR: relevanceOR },
  ];

  if (ticker)    andClauses.push({ tickers:   { has: ticker } });
  if (topic)     andClauses.push({ topics:    { has: topic } });
  if (sentiment) andClauses.push({ sentiment: { equals: sentiment } });

  const where: Prisma.NewsArticleWhereInput = { AND: andClauses };

  const [rows, total, readRows] = await Promise.all([
    prisma.newsArticle.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take:    limit,
    }),
    prisma.newsArticle.count({ where }),
    prisma.userNewsRead.findMany({
      where:  { userId },
      select: { articleId: true },
    }),
  ]);

  const readSet = new Set(readRows.map((r) => r.articleId));

  return {
    articles: rows.map((row) => ({ ...toDTO(row), isRead: readSet.has(row.id) })),
    total,
  };
}

/**
 * Marks an article as read for a user.
 * Upserts so calling it twice is idempotent.
 */
export async function markAsRead(userId: string, articleId: string): Promise<void> {
  await prisma.userNewsRead.upsert({
    where:  { userId_articleId: { userId, articleId } },
    create: { userId, articleId },
    update: {},
  });
}

/**
 * Deletes news articles older than the given number of days.
 * Also cascades deletes on UserNewsRead rows (via DB cascade).
 * Returns the count of deleted articles.
 */
export async function purgeOldNews(olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);
  const { count } = await prisma.newsArticle.deleteMany({
    where: { publishedAt: { lt: cutoff } },
  });
  return count;
}

/**
 * Fetches a single article by ID.
 */
export async function getArticle(id: string): Promise<NewsArticleDTO | null> {
  const row = await prisma.newsArticle.findUnique({ where: { id } });
  if (!row) return null;
  return toDTO(row);
}

// ── DTO mapper ────────────────────────────────────────────────────────────────

function toDTO(row: {
  id:             string;
  url:            string;
  tickers:        string[];
  topics:         string[];
  headline:       string;
  summary:        string | null;
  sentiment:      string | null;
  sentimentScore: number | null;
  impact:         string | null;
  source:         string | null;
  publishedAt:    Date | null;
  insight:        string | null;
  createdAt:      Date;
}): NewsArticleDTO {
  return {
    id:             row.id,
    url:            row.url,
    tickers:        row.tickers,
    topics:         row.topics,
    headline:       row.headline,
    summary:        row.summary,
    sentiment:      row.sentiment as NewsArticleDTO["sentiment"],
    sentimentScore: row.sentimentScore,
    impact:         row.impact as NewsArticleDTO["impact"],
    source:         row.source,
    publishedAt:    row.publishedAt?.toISOString() ?? null,
    insight:        row.insight,
    createdAt:      row.createdAt.toISOString(),
    isRead:         false, // default; overridden by getNewsForUser with user context
  };
}

// ── Domain errors ─────────────────────────────────────────────────────────────

export class ArticleNotFoundError extends Error {
  constructor(id: string) {
    super(`Article ${id} not found.`);
    this.name = "ArticleNotFoundError";
  }
}
