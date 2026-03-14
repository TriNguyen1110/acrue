import cron from "node-cron";
import { tickerScheduler } from "@/services/tickerScheduler";
import { runAlertDetection } from "@/services/alerts";

/**
 * Notification system — owns all background cron jobs.
 *
 * Jobs registered here:
 *   - tickerScheduler: 1s tick, scores + refreshes watchlist quotes via Finnhub
 *   - Alert detection: every 5 minutes during market hours
 *
 * Called once at server startup from app/startup.ts.
 * Safe to call multiple times — subsequent calls are no-ops if already started.
 */

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
}

export function stopNotificationSystem(): void {
  tickerScheduler.stop();
  started = false;
}
