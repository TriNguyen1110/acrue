import { redis } from "@/lib/cache";
import { finnhubGet } from "./client";

const SUMMARY_TTL = 21600; // 6h

export interface AssetSummary {
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
  description: string | null; // not available on Finnhub free tier — always null
  website: string | null;
  employees: number | null;   // not available in Finnhub profile2 — always null
  country: string | null;
  analystRating: string | null;
  targetMeanPrice: number | null;
  recommendationCount: number | null;
}

interface FinnhubProfile {
  name: string;
  finnhubIndustry: string;
  weburl: string;
  country: string;
}

interface FinnhubRecommendation {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
}

interface FinnhubPriceTarget {
  targetMean: number;
}

function deriveRating(rec: FinnhubRecommendation): string {
  const bullish = rec.buy + rec.strongBuy;
  const bearish = rec.sell + rec.strongSell;
  if (bullish > rec.hold && bullish > bearish) return "Buy";
  if (bearish > rec.hold && bearish > bullish) return "Sell";
  return "Hold";
}

export async function getAssetSummary(ticker: string): Promise<AssetSummary> {
  const upper = ticker.toUpperCase();
  const cacheKey = `summary:${upper}`;

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as AssetSummary;

  // Fetch profile, recommendations, and price target in parallel
  // All are high priority — triggered when user opens an asset detail page
  const [profile, recommendations, priceTarget] = await Promise.all([
    finnhubGet<FinnhubProfile>("/stock/profile2", { symbol: upper }, "high"),
    finnhubGet<FinnhubRecommendation[]>("/stock/recommendation", { symbol: upper }, "high"),
    finnhubGet<FinnhubPriceTarget>("/stock/price-target", { symbol: upper }, "high"),
  ]);

  const latestRec = Array.isArray(recommendations) ? recommendations[0] : null;
  const totalRecs = latestRec
    ? latestRec.buy + latestRec.hold + latestRec.sell + latestRec.strongBuy + latestRec.strongSell
    : null;

  const summary: AssetSummary = {
    ticker: upper,
    name: profile?.name ?? upper,
    sector: profile?.finnhubIndustry ?? null,
    industry: null,          // not available via Finnhub free tier
    description: null,       // not available via Finnhub free tier
    website: profile?.weburl ?? null,
    employees: null,         // not available in Finnhub profile2
    country: profile?.country ?? null,
    analystRating: latestRec ? deriveRating(latestRec) : null,
    targetMeanPrice: priceTarget?.targetMean ?? null,
    recommendationCount: totalRecs,
  };

  await redis.setex(cacheKey, SUMMARY_TTL, JSON.stringify(summary));
  return summary;
}
