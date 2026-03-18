export interface SimHolding {
  id:           string;
  ticker:       string;
  shares:       number;
  startPrice:   number;   // price when the holding was added
  currentPrice: number;   // live price
  startValue:   number;   // shares × startPrice
  currentValue: number;   // shares × currentPrice
  returnPct:    number;   // ((currentPrice - startPrice) / startPrice) × 100
}

export interface SimPortfolioMetrics {
  totalStartValue:   number;
  totalCurrentValue: number;
  totalReturnPct:    number;  // ((current - start) / start) × 100
  topGainer:         string | null;
  topLoser:          string | null;
}

export interface SimPortfolio {
  id:          string;
  name:        string;
  description: string | null;
  createdAt:   string;
  holdings:    SimHolding[];
  metrics:     SimPortfolioMetrics;
}

export interface CreateSimPortfolioRequest {
  name:        string;
  description?: string;
}

export interface AddSimHoldingRequest {
  ticker: string;
  shares: number;
}
