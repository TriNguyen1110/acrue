import { prisma } from "@/lib/db";
import { redis } from "@/lib/cache";
import { getQuote } from "@/lib/finnhub";
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
  price_change: { threshold: 2.0, cooldownMinutes: 60  }, // ≥2% day change vs prev close
  volatility:   { threshold: 4.0, cooldownMinutes: 120 }, // ≥4% intraday high-low range
  price_level:  { threshold: 0,   cooldownMinutes: 60  }, // absolute price target crossing
  // below require candle history — not available on Finnhub free tier, kept for UI/rule storage only
  volume_spike: { threshold: 2.5, cooldownMinutes: 60  },
  rsi:          { threshold: 70,  cooldownMinutes: 120 },
  ema_cross:    { threshold: 0,   cooldownMinutes: 240 },
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
 * Runs anomaly detection for a single ticker using only quote-level data.
 *
 * Finnhub's free tier does not expose the /stock/candle endpoint (403).
 * All detection is therefore derived from the /quote response alone:
 *
 *   price_change — |quote.changePct| vs previous close ≥ threshold %
 *   volatility   — intraday range (dayHigh - dayLow) / previousClose ≥ threshold %
 *   price_level  — price crosses a user-defined absolute target
 *
 * volume_spike, rsi, ema_cross require historical candle data and are
 * silently skipped here; their rules remain stored in the DB for future use.
 */
export async function detectAlertsForTicker(
  ticker: string,
  rules: Map<AlertType, { threshold: number; cooldownMinutes: number }>
): Promise<DetectedAlert[]> {
  const detected: DetectedAlert[] = [];

  const quote = await getQuote(ticker, 0.5).catch(() => null);
  if (!quote || quote.price === 0) return [];

  const prevClose = quote.previousClose ?? 0;
  const dayHigh   = quote.dayHigh       ?? 0;
  const dayLow    = quote.dayLow        ?? 0;
  const changePct = quote.changePct     ?? 0;

  // ── Price change ──────────────────────────────────────────────────────────
  // Uses the day's % change vs previous close — available directly from /quote.
  const priceRule  = rules.get("price_change") ?? DEFAULTS.price_change;
  const absDayMove = Math.abs(changePct);
  if (absDayMove >= priceRule.threshold && prevClose > 0) {
    const direction = changePct >= 0 ? "+" : "";
    detected.push({
      ticker,
      type:     "price_change",
      message:  `${ticker} moved ${direction}${changePct.toFixed(2)}% today ($${prevClose.toFixed(2)} → $${quote.price.toFixed(2)})`,
      severity: classifyPriceSeverity(absDayMove, priceRule.threshold),
      rules:    { ruleType: "price_change", threshold: priceRule.threshold, cooldownMinutes: priceRule.cooldownMinutes },
    });
  }

  // ── Intraday range (volatility proxy) ─────────────────────────────────────
  // Measures (dayHigh - dayLow) / previousClose as a % — a rough proxy for
  // intraday volatility. Available entirely from the /quote response.
  const volRule = rules.get("volatility") ?? DEFAULTS.volatility;
  if (dayHigh > 0 && dayLow > 0 && prevClose > 0) {
    const rangePct = ((dayHigh - dayLow) / prevClose) * 100;
    if (rangePct >= volRule.threshold) {
      detected.push({
        ticker,
        type:     "volatility",
        message:  `${ticker} intraday range is ${rangePct.toFixed(1)}% ($${dayLow.toFixed(2)}–$${dayHigh.toFixed(2)})`,
        severity: classifyVolatilitySeverity(rangePct, volRule.threshold),
        rules:    { ruleType: "volatility", threshold: volRule.threshold, cooldownMinutes: volRule.cooldownMinutes },
      });
    }
  }

  // ── Price level ───────────────────────────────────────────────────────────
  // Fires when price crosses a user-defined absolute price target.
  const priceLevelRule = rules.get("price_level");
  if (priceLevelRule && priceLevelRule.threshold > 0 && prevClose > 0) {
    const target      = priceLevelRule.threshold;
    const crossedUp   = prevClose < target && quote.price >= target;
    const crossedDown = prevClose > target && quote.price <= target;
    if (crossedUp || crossedDown) {
      const dir = crossedUp ? "crossed above" : "crossed below";
      detected.push({
        ticker,
        type:     "price_level",
        message:  `${ticker} ${dir} your price target of $${target.toFixed(2)} (now $${quote.price.toFixed(2)})`,
        severity: "high",
        rules:    { ruleType: "price_level", threshold: target, cooldownMinutes: priceLevelRule.cooldownMinutes },
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
  } catch (e) {
    console.error(`[alerts] detection failed for ${ticker}:`, e);
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
