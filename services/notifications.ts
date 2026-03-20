import cron from "node-cron";
import { prisma } from "@/lib/db";
import { tickerScheduler } from "@/services/tickerScheduler";
import { runAlertDetectionForTicker } from "@/services/alerts";
import { newsScheduler } from "@/services/newsScheduler";
import { ingestRssFeeds, purgeOldNews } from "@/services/news";

/**
 * Notification system — owns all background cron jobs.
 *
 * Jobs registered here:
 *   - tickerScheduler: 1s tick, scores + refreshes watchlist quotes via Finnhub
 *   - Alert detection: every 5 minutes
 *   - Alert retention: daily at 03:00 UTC — deletes read alerts older than 30 days
 *     and unread alerts older than 90 days, capping per-user rows at 500
 *
 * Called once at server startup from app/startup.ts.
 * Safe to call multiple times — subsequent calls are no-ops if already started.
 */

const RETENTION_READ_DAYS   = 30;
const RETENTION_UNREAD_DAYS = 90;
const MAX_ALERTS_PER_USER   = 500;

let started = false;

export function startNotificationSystem(): void {
  if (started) return;
  started = true;

  // Start the continuous ticker refresh scheduler (1s tick, in-memory scoring)
  tickerScheduler.start();
  console.log("[notifications] tickerScheduler started");

  // Start the company news ingestion scheduler (one ticker per ~16s drain slot)
  newsScheduler.start();
  console.log("[notifications] newsScheduler started");

  // RSS ingestion — run immediately on startup, then Mon-Fri at market-aligned times
  ingestRssFeeds()
    .then((count) => console.log(`[notifications] RSS ingest (startup): ${count} new article(s)`))
    .catch((e) => console.error("[notifications] RSS ingest (startup) failed:", e));

  cron.schedule("0 7,9,12,16 * * 1-5", async () => {
    try {
      const count = await ingestRssFeeds();
      console.log(`[notifications] RSS ingest: ${count} new article(s)`);
    } catch (e) {
      console.error("[notifications] RSS ingest failed:", e);
    }
  });
  console.log("[notifications] RSS ingestion cron registered (0 7,9,12,16 * * 1-5)");

  // Alert detection — runs after every quote refresh (≤55×/min, driven by tickerScheduler).
  // Quote data is already cached by the time detection reads it; candle/daily data
  // is longer-TTL cached so no extra API calls are added per detection run.
  // Newly created alerts are broadcast to connected WS clients immediately.
  tickerScheduler.addAfterFetchListener((ticker) => {
    runAlertDetectionForTicker(ticker)
      .then((created) => {
        if (created.length === 0) return;
        // Lazy import avoids a circular dependency at module load time
        import("./ws").then(({ wsService }) => {
          for (const alert of created) {
            wsService.broadcastAlert(alert);
          }
        }).catch(() => {});

        // Push notification for high-severity alerts — fires even when the tab is closed
        const highAlerts = created.filter((a) => a.severity === "high");
        if (highAlerts.length > 0) {
          import("./push").then(({ sendPushToUser }) => {
            for (const alert of highAlerts) {
              sendPushToUser(alert.userId, {
                title: `⚠ ${alert.ticker} — High Alert`,
                body:  alert.message,
                url:   "/alerts",
                tag:   `alert-${alert.ticker}-${alert.alertType}`,
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      })
      .catch((e) => {
        console.error(`[notifications] alert detection failed for ${ticker}:`, e);
      });
  });
  console.log("[notifications] alert detection wired to tickerScheduler (≤55×/min)");

  // Alert retention — daily at 03:00 UTC
  cron.schedule("0 3 * * *", async () => {
    try {
      await purgeOldAlerts();
    } catch (e) {
      console.error("[notifications] alert retention failed:", e);
    }
  });
  console.log("[notifications] alert retention cron registered (0 3 * * *)");

  // News retention — daily at 03:30 UTC — delete articles older than 7 days
  cron.schedule("30 3 * * *", async () => {
    try {
      const count = await purgeOldNews(7);
      console.log(`[notifications] news retention: deleted ${count} old article(s)`);
    } catch (e) {
      console.error("[notifications] news retention failed:", e);
    }
  });
  console.log("[notifications] news retention cron registered (30 3 * * *)");
}

export function stopNotificationSystem(): void {
  tickerScheduler.stop();
  newsScheduler.stop();
  started = false;
}

/**
 * Purges stale alerts to keep the table from growing unboundedly.
 *
 * Two passes:
 *   1. Hard TTL — delete read alerts older than 30 days, unread older than 90 days.
 *      Unread alerts get a longer window so users don't lose unseen notifications.
 *   2. Per-user cap — if a user still has more than 500 rows after the TTL pass,
 *      delete the oldest (read-first) until they're at the cap.
 */
async function purgeOldAlerts(): Promise<void> {
  const now = new Date();
  const readCutoff   = new Date(now.getTime() - RETENTION_READ_DAYS   * 86_400_000);
  const unreadCutoff = new Date(now.getTime() - RETENTION_UNREAD_DAYS * 86_400_000);

  // Pass 1: TTL delete
  const { count: deleted } = await prisma.alert.deleteMany({
    where: {
      OR: [
        { read: true,  triggeredAt: { lt: readCutoff   } },
        { read: false, triggeredAt: { lt: unreadCutoff } },
      ],
    },
  });

  // Pass 2: per-user cap — find users over the limit and trim oldest rows
  const overLimit = await prisma.$queryRaw<Array<{ userId: string; count: bigint }>>`
    SELECT "userId", COUNT(*) AS count
    FROM "Alert"
    GROUP BY "userId"
    HAVING COUNT(*) > ${MAX_ALERTS_PER_USER}
  `;

  let capped = 0;
  for (const row of overLimit) {
    const excess = Number(row.count) - MAX_ALERTS_PER_USER;
    // Delete oldest read alerts first, then oldest unread if still over cap
    const oldest = await prisma.alert.findMany({
      where:   { userId: row.userId },
      orderBy: [{ read: "desc" }, { triggeredAt: "asc" }],
      take:    excess,
      select:  { id: true },
    });
    if (oldest.length > 0) {
      const { count } = await prisma.alert.deleteMany({
        where: { id: { in: oldest.map((a) => a.id) } },
      });
      capped += count;
    }
  }

  console.log(`[notifications] retention: deleted ${deleted} by TTL, ${capped} by cap`);
}
