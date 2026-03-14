export type RiskProfile = "conservative" | "moderate" | "aggressive";
export type ScenarioType = "market_downturn" | "sector_shock" | "volatility_spike";

export interface PortfolioHolding {
  id: string;
  ticker: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
  updatedAt: string;
}

export interface PortfolioMetrics {
  expectedReturn: number;
  volatility: number;
  sharpeRatio: number;
  diversificationScore: number; // 0–100
}

export interface PortfolioResponse {
  holdings: PortfolioHolding[];
  metrics: PortfolioMetrics;
  totalValue: number;
  totalPnl: number;
  totalPnlPct: number;
}

export interface AddHoldingRequest {
  ticker: string;
  shares: number;
  avgCost: number;
}

export interface UpdateHoldingRequest {
  shares?: number;
  avgCost?: number;
}

// Optimize
export interface OptimizeResponse {
  suggestedWeights: Record<string, number>;
  projectedReturn: number;
  projectedVolatility: number;
  method: "mean_variance";
}

// Simulate
export interface SimulateRequest {
  scenario: {
    type: ScenarioType;
    magnitude: number;   // e.g. -0.20 for -20%
    durationDays: number;
  };
  runs: number;
}

export interface ProbabilityBand {
  range: [number, number];
  probability: number;
}

export interface SimulateResponse {
  simulationId: string;
  expectedOutcome: number;
  upsideP90: number;
  downsideP10: number;
  probabilityBands: ProbabilityBand[];
}

export interface Simulation {
  id: string;
  scenario: SimulateRequest["scenario"] & { runs: number };
  results: Omit<SimulateResponse, "simulationId">;
  createdAt: string;
}

// Snapshot (saved daily)
export interface PortfolioSnapshot {
  id: string;
  holdings: Array<Pick<PortfolioHolding, "ticker" | "shares" | "avgCost" | "currentPrice" | "pnlPct">>;
  metrics: PortfolioMetrics;
  createdAt: string;
}
