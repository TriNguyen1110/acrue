import { prisma } from "@/lib/db";
import { redis } from "@/lib/cache";
import { getIntradayCandles, getVolumeArray, getDailyReturns, getClosePrices } from "@/services/marketData";
import { getQuote } from "@/lib/finnhub";
import { RSI, EMA } from "technicalindicators";
import type {
  Alert,
  AlertRuleConfig,
  AlertType,
  AlertSeverity,
  PaginatedAlerts,
  UnreadAlertsResponse,
  CreateAlertRuleRequest,
} from "@/types";

// ── Default rule thresholds (used when no user-defined rule exists) ────────────

const DEFAULTS: Record<AlertType, { threshold: number; cooldownMinutes: number }> = {
  price_change: { threshold: 2.0,  cooldownMinutes: 60 },  // 2% move in the last 5-min candle
  volume_spike: { threshold: 2.5,  cooldownMinutes: 60 },  // 2.5σ above mean
  volatility:   { threshold: 40.0, cooldownMinutes: 120 }, // 40% annualised vol
  rsi:          { threshold: 70.0, cooldownMinutes: 120 }, // RSI overbought/oversold
  ema_cross:    { threshold: 0,    cooldownMinutes: 240 }, // EMA crossover signal
  price_level:  { threshold: 0,    cooldownMinutes: 60 },  // Absolute price target
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

export interface AlertFilters {
  type?: AlertType;
  severity?: AlertSeverity;
}

export async function getUserAlerts(
  userId: string,
  page = 1,
  limit = 20,
  filters: AlertFilters = {}
): Promise<PaginatedAlerts> {
  const skip = (page - 1) * limit;
  const where = {
    userId,
    ...(filters.type     ? { type:     filters.type }     : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
  };
  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      orderBy: { triggeredAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.alert.count({ where }),
  ]);

  // Enrich with asset metadata and market cap for ticker classification filters
  const tickers = [...new Set(alerts.map((a) => a.ticker))];

  const [assets, profiles] = await Promise.all([
    tickers.length > 0
      ? prisma.asset.findMany({
          where: { ticker: { in: tickers } },
          select: { ticker: true, sector: true, industry: true, type: true },
        })
      : Promise.resolve([]),
    tickers.length > 0
      ? Promise.all(
          tickers.map((t) =>
            redis.get(`finnhub:profile:${t}`).then((v) => ({ ticker: t, raw: v }))
          )
        )
      : Promise.resolve([]),
  ]);

  const assetMap = new Map<string, { sector: string | null; industry: string | null; type: string }>(
    assets.map((a) => [a.ticker, a])
  );
  const marketCapMap = new Map<string, number>();
  for (const { ticker, raw } of profiles) {
    if (!raw) continue;
    try {
      const p = JSON.parse(raw) as { marketCapitalization?: number };
      if (p.marketCapitalization) marketCapMap.set(ticker, p.marketCapitalization * 1_000_000);
    } catch {
      // ignore malformed cache entries
    }
  }

  return {
    alerts: alerts.map((a) => toAlertDTO(a, assetMap, marketCapMap)),
    page,
    limit,
    total,
  };
}

export async function getUnreadAlerts(userId: string): Promise<UnreadAlertsResponse> {
  const alerts = await prisma.alert.findMany({
    where: { userId, read: false },
    orderBy: { triggeredAt: "desc" },
    take: 50,
  });

  return {
    count: alerts.length,
    alerts: alerts.map((a) => toAlertDTO(a)),
  };
}

export async function markAlertRead(userId: string, alertId: string): Promise<void> {
  const updated = await prisma.alert.updateMany({
    where: { id: alertId, userId },
    data: { read: true },
  });
  if (updated.count === 0) throw new AlertNotFoundError(alertId);
}

export async function markAllAlertsRead(userId: string): Promise<void> {
  await prisma.alert.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}

export async function deleteAlert(userId: string, alertId: string): Promise<void> {
  const deleted = await prisma.alert.deleteMany({
    where: { id: alertId, userId },
  });
  if (deleted.count === 0) throw new AlertNotFoundError(alertId);
}

// ── Alert Rules CRUD ──────────────────────────────────────────────────────────

export async function getUserAlertRules(userId: string) {
  return prisma.alertRule.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createAlertRule(userId: string, data: CreateAlertRuleRequest) {
  try {
    return await prisma.alertRule.create({
      data: {
        userId,
        ticker: data.ticker.toUpperCase(),
        ruleType: data.ruleType,
        threshold: data.threshold,
        cooldownMinutes: data.cooldownMinutes,
      },
    });
  } catch (e: unknown) {
    if (isPrismaUniqueError(e)) throw new DuplicateRuleError(data.ticker, data.ruleType);
    throw e;
  }
}

export async function updateAlertRule(
  userId: string,
  ruleId: string,
  data: Partial<Pick<CreateAlertRuleRequest, "threshold" | "cooldownMinutes">>
) {
  const updated = await prisma.alertRule.updateMany({
    where: { id: ruleId, userId },
    data,
  });
  if (updated.count === 0) throw new RuleNotFoundError(ruleId);
}

export async function deleteAlertRule(userId: string, ruleId: string): Promise<void> {
  const deleted = await prisma.alertRule.deleteMany({
    where: { id: ruleId, userId },
  });
  if (deleted.count === 0) throw new RuleNotFoundError(ruleId);
}

// ── Anomaly detection ─────────────────────────────────────────────────────────

interface DetectedAlert {
  ticker: string;
  type: AlertType;
  message: string;
  severity: AlertSeverity;
  rules: AlertRuleConfig;
}

/**
 * Runs anomaly detection for a single ticker against all three alert types.
 *
 * Detection logic:
 *   price_change — |current price vs yesterday's close| > threshold %
 *   volume_spike — today's intraday volume z-score vs 30-day rolling mean/stddev
 *   volatility   — annualised rolling 20-day stddev of log returns > threshold %
 *
 * Cooldown is enforced by checking whether an alert of the same type was
 * already fired within the configured cooldown window. This prevents alert
 * storms when a threshold condition persists for multiple detection cycles.
 */
export async function detectAlertsForTicker(
  ticker: string,
  rules: Map<AlertType, { threshold: number; cooldownMinutes: number }>
): Promise<DetectedAlert[]> {
  const detected: DetectedAlert[] = [];

  // Fetch all data needed for detection in parallel
  const [quote, candles, volumes, returns, closes] = await Promise.all([
    getQuote(ticker, 0.5).catch(() => null),
    getIntradayCandles(ticker, "5m", 24).catch(() => []),
    getVolumeArray(ticker, 30).catch(() => []),
    getDailyReturns(ticker, 20).catch(() => []),
    getClosePrices(ticker, 60).catch(() => []),  // 60 days needed for EMA(21) warmup
  ]);

  if (!quote) return [];

  // ── Price change (5-min interval) ────────────────────────────────────────
  // Compares current price to the close of the last completed 5-min candle.
  // This catches sudden intraday spikes rather than slow drifts from yesterday's close.
  const priceRule = rules.get("price_change") ?? DEFAULTS.price_change;
  if (candles.length >= 2) {
    const prevCandle = candles[candles.length - 2]; // last fully completed 5-min bar
    const prevPrice  = prevCandle.close;
    if (prevPrice > 0) {
      const changePct = Math.abs((quote.price - prevPrice) / prevPrice * 100);
      if (changePct >= priceRule.threshold) {
        const direction = quote.price > prevPrice ? "+" : "";
        const pct = ((quote.price - prevPrice) / prevPrice * 100).toFixed(2);
        detected.push({
          ticker,
          type: "price_change",
          message: `${ticker} moved ${direction}${pct}% in the last 5 minutes ($${prevPrice.toFixed(2)} → $${quote.price.toFixed(2)})`,
          severity: classifyPriceSeverity(changePct, priceRule.threshold),
          rules: { ruleType: "price_change", threshold: priceRule.threshold, cooldownMinutes: priceRule.cooldownMinutes },
        });
      }
    }
  }

  // ── Volume spike ──────────────────────────────────────────────────────────
  const volumeRule = rules.get("volume_spike") ?? DEFAULTS.volume_spike;
  if (volumes.length >= 10 && candles.length > 0) {
    const todayVolume = candles.reduce((sum, c) => sum + c.volume, 0);
    const mean = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const variance = volumes.reduce((a, b) => a + (b - mean) ** 2, 0) / volumes.length;
    const stddev = Math.sqrt(variance);

    if (stddev > 0) {
      const zScore = (todayVolume - mean) / stddev;
      if (zScore >= volumeRule.threshold) {
        const multiplier = (todayVolume / mean).toFixed(1);
        detected.push({
          ticker,
          type: "volume_spike",
          message: `${ticker} volume is ${multiplier}x average (z-score: ${zScore.toFixed(2)})`,
          severity: classifyZScoreSeverity(zScore, volumeRule.threshold),
          rules: { ruleType: "volume_spike", threshold: volumeRule.threshold, cooldownMinutes: volumeRule.cooldownMinutes },
        });
      }
    }
  }

  // ── Volatility ────────────────────────────────────────────────────────────
  const volRule = rules.get("volatility") ?? DEFAULTS.volatility;
  if (returns.length >= 10) {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
    const annualisedVol = Math.sqrt(variance * 252) * 100; // % annualised

    if (annualisedVol >= volRule.threshold) {
      detected.push({
        ticker,
        type: "volatility",
        message: `${ticker} 20-day annualised volatility is ${annualisedVol.toFixed(1)}% (above ${volRule.threshold}% threshold)`,
        severity: classifyVolatilitySeverity(annualisedVol, volRule.threshold),
        rules: { ruleType: "volatility", threshold: volRule.threshold, cooldownMinutes: volRule.cooldownMinutes },
      });
    }
  }

  // ── RSI ───────────────────────────────────────────────────────────────────
  // Fires when RSI(14) crosses into overbought (>70) or oversold (<30) territory.
  // "Cross into" means the previous period was on the other side of the threshold —
  // this avoids repeatedly re-alerting while RSI stays deeply overbought/oversold.
  const rsiRule = rules.get("rsi") ?? DEFAULTS.rsi;
  if (closes.length >= 15) {
    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    if (rsiValues.length >= 2) {
      const prev = rsiValues[rsiValues.length - 2];
      const curr = rsiValues[rsiValues.length - 1];
      const overbought = rsiRule.threshold;       // default 70
      const oversold   = 100 - overbought;        // default 30

      if (prev < overbought && curr >= overbought) {
        detected.push({
          ticker,
          type: "rsi",
          message: `${ticker} RSI(14) entered overbought territory at ${curr.toFixed(1)} (above ${overbought})`,
          severity: curr >= overbought + 5 ? "high" : "medium",
          rules: { ruleType: "rsi", threshold: rsiRule.threshold, cooldownMinutes: rsiRule.cooldownMinutes },
        });
      } else if (prev > oversold && curr <= oversold) {
        detected.push({
          ticker,
          type: "rsi",
          message: `${ticker} RSI(14) entered oversold territory at ${curr.toFixed(1)} (below ${oversold})`,
          severity: curr <= oversold - 5 ? "high" : "medium",
          rules: { ruleType: "rsi", threshold: rsiRule.threshold, cooldownMinutes: rsiRule.cooldownMinutes },
        });
      }
    }
  }

  // ── EMA crossover ─────────────────────────────────────────────────────────
  // Fires when EMA(9) crosses EMA(21) — a classic momentum signal.
  // Golden cross (9 crosses above 21) = bullish; death cross = bearish.
  const emaCrossRule = rules.get("ema_cross") ?? DEFAULTS.ema_cross;
  if (closes.length >= 22) {
    const ema9  = EMA.calculate({ values: closes, period: 9 });
    const ema21 = EMA.calculate({ values: closes, period: 21 });

    // Align the two series to the same length (EMA9 has more values than EMA21)
    const offset = ema9.length - ema21.length;
    const prev9  = ema9[ema9.length - 2];
    const curr9  = ema9[ema9.length - 1];
    const prev21 = ema21[ema21.length - 1 - offset < 0 ? 0 : ema21.length - 2];
    const curr21 = ema21[ema21.length - 1];

    const wasBelowOrEqual = prev9 <= prev21;
    const wasAboveOrEqual = prev9 >= prev21;

    if (wasBelowOrEqual && curr9 > curr21) {
      detected.push({
        ticker,
        type: "ema_cross",
        message: `${ticker} EMA(9) crossed above EMA(21) — bullish momentum signal ($${curr9.toFixed(2)} > $${curr21.toFixed(2)})`,
        severity: "medium",
        rules: { ruleType: "ema_cross", threshold: emaCrossRule.threshold, cooldownMinutes: emaCrossRule.cooldownMinutes },
      });
    } else if (wasAboveOrEqual && curr9 < curr21) {
      detected.push({
        ticker,
        type: "ema_cross",
        message: `${ticker} EMA(9) crossed below EMA(21) — bearish momentum signal ($${curr9.toFixed(2)} < $${curr21.toFixed(2)})`,
        severity: "medium",
        rules: { ruleType: "ema_cross", threshold: emaCrossRule.threshold, cooldownMinutes: emaCrossRule.cooldownMinutes },
      });
    }
  }

  // ── Price level ───────────────────────────────────────────────────────────
  // Fires when price crosses a user-defined absolute price target.
  // Uses previousClose as yesterday's price to detect the crossing direction.
  const priceLevelRule = rules.get("price_level");
  if (priceLevelRule && priceLevelRule.threshold > 0 && quote.previousClose != null && quote.previousClose > 0) {
    const target = priceLevelRule.threshold;
    const crossedUp   = quote.previousClose < target && quote.price >= target;
    const crossedDown = quote.previousClose > target && quote.price <= target;

    if (crossedUp || crossedDown) {
      const dir = crossedUp ? "crossed above" : "crossed below";
      detected.push({
        ticker,
        type: "price_level",
        message: `${ticker} ${dir} your price target of $${target.toFixed(2)} (now $${quote.price.toFixed(2)})`,
        severity: "high",  // price targets are always user-intentional — treat as high
        rules: { ruleType: "price_level", threshold: target, cooldownMinutes: priceLevelRule.cooldownMinutes },
      });
    }
  }

  return detected;
}

/**
 * Runs alert detection for a single ticker across all users watching it.
 *
 * Called by the tickerScheduler after each quote refresh so detection runs at
 * the full 55 req/min rate rather than on a coarse 5-minute polling interval.
 * Quote data is already cached from the scheduler's fetch; candles and daily
 * data are longer-TTL cached so they add negligible extra API calls.
 */
export async function runAlertDetectionForTicker(ticker: string): Promise<void> {
  const watchers = await prisma.watchlist.findMany({
    where:  { ticker },
    select: { userId: true },
  });
  if (watchers.length === 0) return;

  const userIds = [...new Set(watchers.map((w) => w.userId))];

  const rules = await prisma.alertRule.findMany({
    where:  { ticker, userId: { in: userIds } },
    select: { userId: true, ruleType: true, threshold: true, cooldownMinutes: true },
  });

  // Per-user rule map for cooldown fan-out
  const userRuleMap = new Map<string, Map<AlertType, { threshold: number; cooldownMinutes: number }>>();
  for (const rule of rules) {
    if (!userRuleMap.has(rule.userId)) userRuleMap.set(rule.userId, new Map());
    userRuleMap.get(rule.userId)!.set(rule.ruleType as AlertType, {
      threshold:       rule.threshold,
      cooldownMinutes: rule.cooldownMinutes,
    });
  }

  // Combined most-sensitive thresholds across all watchers
  const combinedRules = new Map<AlertType, { threshold: number; cooldownMinutes: number }>();
  for (const [, userRules] of userRuleMap) {
    for (const [type, rule] of userRules) {
      const existing = combinedRules.get(type);
      if (!existing || rule.threshold < existing.threshold) {
        combinedRules.set(type, rule);
      }
    }
  }

  let detected: DetectedAlert[];
  try {
    detected = await detectAlertsForTicker(ticker, combinedRules);
  } catch {
    return;
  }
  if (detected.length === 0) return;

  const now = new Date();
  for (const userId of userIds) {
    for (const alert of detected) {
      const rule = userRuleMap.get(userId)?.get(alert.type) ?? DEFAULTS[alert.type];
      const cutoff = new Date(now.getTime() - rule.cooldownMinutes * 60_000);

      const recent = await prisma.alert.findFirst({
        where:  { userId, ticker: alert.ticker, type: alert.type, triggeredAt: { gte: cutoff } },
        select: { id: true },
      });
      if (recent) continue;

      await prisma.alert.create({
        data: {
          userId,
          ticker:    alert.ticker,
          type:      alert.type,
          message:   alert.message,
          severity:  alert.severity,
          rules:     alert.rules as object,
        },
      });
    }
  }
}

/**
 * Bulk detection fallback — iterates all watchlist tickers sequentially.
 * Not used in the hot path (tickerScheduler drives per-ticker detection),
 * but kept for manual runs and integration tests.
 */
export async function runAlertDetection(): Promise<void> {
  const rows = await prisma.watchlist.findMany({
    select:   { ticker: true },
    distinct: ["ticker"],
  });
  for (const { ticker } of rows) {
    await runAlertDetectionForTicker(ticker).catch(() => {});
  }
}

// ── Severity classifiers ──────────────────────────────────────────────────────

function classifyPriceSeverity(changePct: number, threshold: number): AlertSeverity {
  const ratio = changePct / threshold;
  if (ratio >= 2.5) return "high";
  if (ratio >= 1.5) return "medium";
  return "low";
}

function classifyZScoreSeverity(z: number, threshold: number): AlertSeverity {
  const excess = z - threshold;
  if (excess >= 2) return "high";
  if (excess >= 1) return "medium";
  return "low";
}

function classifyVolatilitySeverity(vol: number, threshold: number): AlertSeverity {
  const ratio = vol / threshold;
  if (ratio >= 2) return "high";
  if (ratio >= 1.5) return "medium";
  return "low";
}

// ── DTO mapper ────────────────────────────────────────────────────────────────

function toAlertDTO(
  row: {
    id: string;
    ticker: string;
    type: string;
    message: string;
    severity: string;
    triggeredAt: Date;
    read: boolean;
    rules: unknown;
  },
  assetMap?: Map<string, { sector: string | null; industry: string | null; type: string }>,
  marketCapMap?: Map<string, number>
): Alert {
  const asset     = assetMap?.get(row.ticker);
  const marketCap = marketCapMap?.get(row.ticker);
  return {
    id: row.id,
    ticker: row.ticker,
    type: row.type as AlertType,
    message: row.message,
    severity: row.severity as AlertSeverity,
    triggeredAt: row.triggeredAt.toISOString(),
    read: row.read,
    rules: (row.rules ?? {}) as AlertRuleConfig,
    ...(asset?.sector   ? { sector:    asset.sector }    : {}),
    ...(asset?.industry ? { industry:  asset.industry }  : {}),
    ...(asset?.type     ? { assetType: asset.type }      : {}),
    ...(marketCap       ? { marketCap }                  : {}),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code: string }).code === "P2002"
  );
}

// ── Domain errors ─────────────────────────────────────────────────────────────

export class AlertNotFoundError extends Error {
  constructor(id: string) {
    super(`Alert ${id} not found.`);
    this.name = "AlertNotFoundError";
  }
}

export class RuleNotFoundError extends Error {
  constructor(id: string) {
    super(`Alert rule ${id} not found.`);
    this.name = "RuleNotFoundError";
  }
}

export class DuplicateRuleError extends Error {
  constructor(ticker: string, ruleType: string) {
    super(`A ${ruleType} rule for ${ticker} already exists.`);
    this.name = "DuplicateRuleError";
  }
}
