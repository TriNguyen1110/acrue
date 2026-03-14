import type { SignalWeights } from "./auth";

export type SignalDirection = "bullish" | "bearish";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface SignalComponent {
  value: number;   // 0–100
  weight: number;  // 0–1
}

export interface SignalBreakdown {
  priceMomentum: SignalComponent;
  volumeAnomaly: SignalComponent;
  volatility: SignalComponent;
  newsSentiment: SignalComponent;
}

export interface SignalScore {
  id: string;
  ticker: string;
  score: number;          // 0–100 (>50 bullish, <50 bearish)
  direction: SignalDirection;
  confidence: ConfidenceLevel;
  breakdown: SignalBreakdown;
  scoredAt: string;
}

export interface UpdateSignalWeightsRequest {
  weights: SignalWeights;
}
