export type Sentiment = "positive" | "neutral" | "negative";
export type ImpactLevel = "low" | "medium" | "high";

export interface NewsArticle {
  id: string;
  tickers: string[];
  headline: string;
  summary: string | null;
  sentiment: Sentiment | null;
  sentimentScore: number | null; // 0–1
  impact: ImpactLevel | null;
  source: string | null;
  publishedAt: string | null;
  insight: string | null;
  createdAt: string;
}

export interface PaginatedNews {
  articles: NewsArticle[];
  page: number;
  limit: number;
  total: number;
}
