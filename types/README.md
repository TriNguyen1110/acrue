# types/

Shared TypeScript interfaces used across `lib/`, `services/`, `app/api/`, and `components/`.

**Rule:** Types here must be pure data shapes — no business logic, no imports from `lib/` or `services/`. If a type needs a computed field, compute it in the service and return a new type.

## Files

| File | What it defines |
|------|----------------|
| `market.ts` | `Quote`, `Candle`, `ChartInterval`, `AssetSearchResult` |
| `auth.ts` | `User`, `JWTPayload`, `SignalWeights` |
| `watchlist.ts` | `WatchlistEntry`, `AddToWatchlistRequest` |
| `alerts.ts` | `Alert`, `AlertRule`, `AlertType`, `AlertSeverity` |
| `news.ts` | `NewsArticle`, `SentimentLabel` |
| `signals.ts` | `SignalScore`, `SignalBreakdown`, `SignalComponent` |
| `portfolio.ts` | `PortfolioHolding`, `PortfolioMetrics`, `SimulateRequest`, `SimulateResponse` |
| `index.ts` | Re-exports everything — import from `@/types` not individual files |

## Import convention

Always import from the barrel:
```ts
import type { Quote, Candle } from "@/types";
```
Not from individual files:
```ts
// avoid
import type { Quote } from "@/types/market";
```
