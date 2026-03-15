/**
 * Next.js instrumentation hook — runs once when the server process starts.
 *
 * Used to boot background services that must be alive for the lifetime of
 * the process: the ticker refresh scheduler and the alert detection cron.
 *
 * Only runs in the Node.js runtime (not Edge). The `NEXT_RUNTIME` guard
 * prevents the import from being evaluated during the Edge bundling pass,
 * which would fail because `node-cron` and `ioredis` are Node-only.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startNotificationSystem } = await import("@/services/notifications");
    startNotificationSystem();
  }
}
