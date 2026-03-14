import type { Quote } from "./market";

export interface WatchlistEntry {
  id: string;
  ticker: string;
  addedAt: string;
}

// Enriched with live quote — returned by GET /api/v1/watchlist
export interface WatchlistItem extends WatchlistEntry {
  quote: Quote;
  sector?: string;
}

export interface AddToWatchlistRequest {
  ticker: string;
}

export interface AddToWatchlistResponse {
  id: string;
  ticker: string;
  addedAt: string;
}
