import type { SignalWeights } from "./auth";

export type SignalDirection = "bullish" | "bearish";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface SignalComponent {
  value: number;   // 0–100
  weight: number;  // 0–1
}

export interface SignalBreakdown {
  priceMomentum:    SignalComponent;
  analystConsensus: SignalComponent;
  valuation:        SignalComponent;
  newsSentiment:    SignalComponent;
}

/** Key financial metrics derived from quote + analyst data. */
export interface SignalMetrics {
  totalReturn52w:  number | null;  // % gain from 52w low to current price
  sharpeEstimate:  number | null;  // (annual expected return - 5% risk-free) / annual vol
  peRatio:         number | null;  // trailing price / EPS
  pegRatio:        number | null;  // P/E ÷ implied growth rate (from analyst target)
  analystTarget:   number | null;  // mean analyst price target
  upsidePct:       number | null;  // % upside to analyst target
  analystRating:   string | null;  // Buy | Hold | Sell
}

/**
 * Monte-Carlo-style 30-day forward projection.
 * Derived from 52-week range as volatility proxy + analyst-implied expected return.
 *
 * 90% confidence interval: ±1.645σ around expected return.
 */
export interface SignalProjection {
  horizon:           "30d";
  expectedReturnPct: number;  // mean scenario (%)
  worstCasePct:      number;  // 5th percentile (%)
  bestCasePct:       number;  // 95th percentile (%)
  probPositive:      number;  // P(return > 0), 0–1
  annualVolPct:      number;  // estimated annual volatility (%)
}

export interface SignalScore {
  id:         string;
  ticker:     string;
  score:      number;           // 0–100 composite (>50 bullish, <50 bearish)
  direction:  SignalDirection;
  confidence: ConfidenceLevel;
  breakdown:  SignalBreakdown;
  metrics:    SignalMetrics;
  projection: SignalProjection;
  scoredAt:   string;           // ISO
}

export interface SignalsResponse {
  scores: SignalScore[];
}

export interface UpdateSignalWeightsRequest {
  weights: SignalWeights;
}
