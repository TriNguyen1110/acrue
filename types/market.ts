// Live quote data (from Finnhub /quote + /stock/profile2 + /stock/metric)
export interface Quote {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  avgVolume: number;
  marketCap: number | null;
  pe: number | null;
  week52High: number | null;
  week52Low: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  open: number | null;
  previousClose: number | null;
  marketState: "REGULAR" | "PRE" | "POST" | "CLOSED" | "PREPRE" | "POSTPOST";
  exchange: string;
  currency: string;
  quoteType: "EQUITY" | "ETF" | "MUTUALFUND" | "CRYPTOCURRENCY" | "INDEX" | string;
  updatedAt: string; // ISO timestamp
}

// OHLCV candle (from Finnhub /stock/candle)
export interface Candle {
  date: string; // ISO timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjClose?: number;
}

export type ChartInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1wk" | "1mo";

// Search result item
export interface AssetSearchResult {
  ticker: string;
  name: string;
  exchange: string;
  quoteType: string;
  sector?: string;
  industry?: string;
  diversifies?: boolean; // true when this ticker's sector is underrepresented in user's watchlist
}
