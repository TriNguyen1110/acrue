# components/

Reusable UI components split into two strict tiers.

## Tiers

### `ui/` — stateless, presentational
- Props only. No fetching, no side effects, no local state beyond UI interactions (e.g. hover).
- Must be reusable anywhere in the app without context.
- Examples: `StockCard`, `AlertBadge`, `SignalBar`, `PriceChange`

### `stateful/` — own their data or local state
- May fetch data via SWR/React Query or hold meaningful local state.
- Used inside page components. Not reused across unrelated pages.
- Examples: `WatchlistTable`, `AlertsFeed`, `SignalScoreList`, `PortfolioChart`

## Rules

| Rule | Reason |
|------|--------|
| Never fetch inside `ui/` | Keeps presentational components pure and testable |
| Never put page layout inside `stateful/` | Layout belongs in `app/(pages)/*/page.tsx` |
| `ui/` components must accept all data via props | Enables easy Storybook stories and snapshot tests |
| Keep `stateful/` components focused on one domain | A watchlist component shouldn't know about portfolio data |
