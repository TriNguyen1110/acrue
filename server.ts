/**
 * Custom Next.js server.
 *
 * Replaces `next dev` / `next start` so we can:
 *   1. Attach a ws.Server to the same HTTP server (Next.js's own server
 *      doesn't expose the underlying http.Server, so we create it ourselves).
 *   2. Start background services before the server begins accepting requests.
 *
 * Usage:
 *   dev  → tsx server.ts
 *   prod → NODE_ENV=production tsx server.ts  (after `next build`)
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";

const dev  = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app    = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // ── Background services ──────────────────────────────────────────────────
  // Import dynamically so they resolve after Next.js has set up its module
  // aliases (tsconfig paths / @/ prefix) via `app.prepare()`.
  const { startNotificationSystem } = await import("./services/notifications");
  const { wsService }               = await import("./services/ws");

  // ── HTTP server ───────────────────────────────────────────────────────────
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Attach WebSocket server before listen() so the upgrade handler is ready
  // for the very first connection.
  wsService.init(server);

  // Start ticker scheduler, alert detection, news ingestion etc.
  // The `started` guard in notifications.ts makes this idempotent if
  // instrumentation.ts also fires (e.g. during `next build`).
  startNotificationSystem();

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? "dev" : "prod"})`);
  });
});
