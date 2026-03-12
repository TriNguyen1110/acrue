# ACRUE DB Plan

## Database: PostgreSQL

---

## Tables

### `users`
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  preferences   JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `watchlist`
```sql
CREATE TABLE watchlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker     TEXT NOT NULL,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);
```

---

### `alerts`
```sql
CREATE TABLE alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker       TEXT NOT NULL,
  type         TEXT NOT NULL,         -- price_change | volume_spike | volatility
  message      TEXT NOT NULL,
  severity     TEXT NOT NULL,         -- low | medium | high
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  read         BOOLEAN DEFAULT FALSE,
  rules        JSONB DEFAULT '{}'     -- optional: { threshold, cooldown_minutes, rule_type }
);
```

---

### `news_articles`
```sql
CREATE TABLE news_articles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tickers      TEXT[] NOT NULL,
  headline     TEXT NOT NULL,
  summary      TEXT,
  sentiment    TEXT,                  -- positive | neutral | negative
  sentiment_score FLOAT,             -- 0-1
  impact       TEXT,                 -- low | medium | high
  source       TEXT,
  published_at TIMESTAMPTZ,
  insight      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `signal_scores`
```sql
CREATE TABLE signal_scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker     TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score      FLOAT NOT NULL,          -- 0-100
  direction  TEXT NOT NULL,           -- bullish | bearish
  confidence TEXT NOT NULL,           -- low | medium | high
  breakdown  JSONB NOT NULL,          -- { price_momentum, volume_anomaly, volatility, news_sentiment }
  scored_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `portfolio_holdings`
```sql
CREATE TABLE portfolio_holdings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ticker        TEXT NOT NULL,
  shares        FLOAT NOT NULL,
  avg_cost      FLOAT NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, ticker)
);
```

---

### `portfolio_snapshots`
```sql
CREATE TABLE portfolio_snapshots (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  holdings   JSONB NOT NULL,          -- [{ ticker, shares, avg_cost, current_price, pnl_pct }]
  metrics    JSONB NOT NULL,          -- { expected_return, volatility, sharpe_ratio, diversification_score }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### `simulations`
```sql
CREATE TABLE simulations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scenario   JSONB NOT NULL,          -- { type, magnitude, duration_days, runs }
  results    JSONB NOT NULL,          -- { expected_outcome, upside_p90, downside_p10, probability_bands }
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Indexes

```sql
-- watchlist lookups by user
CREATE INDEX idx_watchlist_user ON watchlist(user_id);

-- alerts by user, unread filter
CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_unread ON alerts(user_id, read) WHERE read = FALSE;

-- news by ticker (GIN for array search)
CREATE INDEX idx_news_tickers ON news_articles USING GIN(tickers);
CREATE INDEX idx_news_published ON news_articles(published_at DESC);

-- signal scores by ticker + time
CREATE INDEX idx_signals_ticker ON signal_scores(ticker, scored_at DESC);
CREATE INDEX idx_signals_user ON signal_scores(user_id, scored_at DESC);

-- portfolio holdings by user
CREATE INDEX idx_holdings_user ON portfolio_holdings(user_id);

-- snapshots by user + time
CREATE INDEX idx_snapshots_user ON portfolio_snapshots(user_id, created_at DESC);

-- simulations by user
CREATE INDEX idx_simulations_user ON simulations(user_id, created_at DESC);
```

---

## Service → Table Mapping

| Service | Tables |
|---------|--------|
| Auth | `users` |
| Watchlist | `watchlist` |
| Notification System | `alerts` |
| News System | `news_articles` |
| Signals System | `signal_scores` |
| Market Data | — (writes to Cache only) |
| Portfolio | `portfolio_holdings`, `portfolio_snapshots`, `simulations` |

---

## Notes

- `alerts.rules` stores optional threshold/cooldown config as JSONB — no separate `alert_rules` table
- `portfolio_snapshots` saved once daily by the scheduler job
- All tables use UUID primary keys and reference `users(id)` with `ON DELETE CASCADE`
