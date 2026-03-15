import cron from "node-cron";
import { prisma } from "@/lib/db";
import { tickerScheduler } from "@/services/tickerScheduler";
import { runAlertDetection } from "@/services/alerts";

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

  // Alert detection — every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      await runAlertDetection();
    } catch (e) {
      console.error("[notifications] alert detection failed:", e);
    }
  });
  console.log("[notifications] alert detection cron registered (*/5 * * * *)");

  // Alert retention — daily at 03:00 UTC
  cron.schedule("0 3 * * *", async () => {
    try {
      await purgeOldAlerts();
    } catch (e) {
      console.error("[notifications] alert retention failed:", e);
    }
  });
  console.log("[notifications] alert retention cron registered (0 3 * * *)");
}

export function stopNotificationSystem(): void {
  tickerScheduler.stop();
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
