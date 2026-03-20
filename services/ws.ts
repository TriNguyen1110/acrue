import type { Server as HttpServer } from "http";
import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { decode } from "@auth/core/jwt";
import { prisma } from "@/lib/db";
import { tickerScheduler } from "@/services/tickerScheduler";
import type { Quote } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WsClient {
  userId: string;
  tickers: Set<string>;
  ws: WebSocket;
}

export interface WsAlertPayload {
  userId: string;
  id: string;
  ticker: string;
  alertType: string;
  message: string;
  severity: string;
  triggeredAt: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * WebSocket service — manages authenticated client connections and pushes
 * real-time quote ticks and alert notifications to subscribed users.
 *
 * Two message types pushed server → client:
 *   { type: "quote",  ticker, price, changePct, volume }
 *   { type: "alert",  id, ticker, alertType, message, severity, triggeredAt }
 *
 * Client → server messages handled:
 *   { type: "ping" }             → { type: "pong" }
 *   { type: "subscribe",   ticker } → add ticker to subscription
 *   { type: "unsubscribe", ticker } → remove ticker from subscription
 *
 * Authentication: session cookie read from the WS upgrade request.
 * The next-auth session JWT is decoded directly — no extra round-trip needed.
 */
class WsService {
  private clients: Map<WebSocket, WsClient> = new Map();

  /**
   * Attach the WS server to the existing HTTP server and register the
   * tickerScheduler listener that drives live quote broadcasts.
   *
   * Call this once after the HTTP server is created (in server.ts), before
   * the server starts listening so the upgrade handler is wired up in time.
   */
  init(server: HttpServer): void {
    // noServer mode — we handle the upgrade event ourselves so that
    // Next.js's HMR websocket (/_next/webpack-hmr) is not intercepted.
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req: IncomingMessage, socket, head) => {
      if (req.url !== "/ws") return; // let Next.js handle HMR and anything else
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    });

    wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
      const userId = await this.authenticateRequest(req);
      if (!userId) {
        ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
        ws.close(1008, "Unauthorized");
        return;
      }

      // Load the user's current watchlist so we know which quote ticks to forward
      const rows = await prisma.watchlist.findMany({
        where:  { userId },
        select: { ticker: true },
      }).catch(() => [] as Array<{ ticker: string }>);

      const tickers = new Set(rows.map((r) => r.ticker.toUpperCase()));
      const client: WsClient = { userId, tickers, ws };
      this.clients.set(ws, client);

      ws.send(JSON.stringify({ type: "subscribed", tickers: [...tickers] }));

      ws.on("message", (data: Buffer | string) => {
        try {
          const msg = JSON.parse(data.toString()) as {
            type: string;
            ticker?: string;
          };
          if (msg.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          } else if (msg.type === "subscribe" && msg.ticker) {
            client.tickers.add(msg.ticker.toUpperCase());
          } else if (msg.type === "unsubscribe" && msg.ticker) {
            client.tickers.delete(msg.ticker.toUpperCase());
          }
        } catch {
          // malformed message — ignore silently
        }
      });

      ws.on("close", () => this.clients.delete(ws));
      ws.on("error", () => this.clients.delete(ws));
    });

    // Every successful quote fetch by the scheduler triggers a broadcast
    // to all clients watching that ticker.
    tickerScheduler.addAfterFetchListener((ticker: string, quote: Quote) => {
      this.broadcastQuote(ticker, quote);
    });

    console.log("[ws] WebSocket server listening at /ws");
  }

  /**
   * Push a live quote tick to all clients subscribed to that ticker.
   * Called by the tickerScheduler afterFetchListener — up to 55×/min.
   */
  broadcastQuote(ticker: string, quote: Quote): void {
    const upper = ticker.toUpperCase();
    const msg = JSON.stringify({
      type:      "quote",
      ticker:    upper,
      price:     quote.price,
      changePct: quote.changePct,
      volume:    quote.volume,
    });

    for (const [, client] of this.clients) {
      if (client.tickers.has(upper) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }

  /**
   * Push a new alert notification to the affected user.
   * Called from notifications.ts after alert detection.
   */
  broadcastAlert(payload: WsAlertPayload): void {
    const { userId, ...rest } = payload;
    const msg = JSON.stringify({ type: "alert", ...rest });

    for (const [, client] of this.clients) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  /**
   * Extracts the user ID from the next-auth session cookie on the WS upgrade
   * request. Returns null if the cookie is absent, malformed, or the secret is
   * wrong.
   *
   * next-auth v5 stores the session as a signed JWT in:
   *   HTTP  → "next-auth.session-token"
   *   HTTPS → "__Secure-next-auth.session-token"
   *
   * The decode() call from @auth/core/jwt needs the `salt` parameter (cookie
   * name) to match what next-auth used when writing the token.
   */
  private async authenticateRequest(req: IncomingMessage): Promise<string | null> {
    const cookieHeader = req.headers.cookie ?? "";

    const cookies: Record<string, string> = {};
    for (const part of cookieHeader.split(";")) {
      const eqIdx = part.indexOf("=");
      if (eqIdx === -1) continue;
      const key = decodeURIComponent(part.slice(0, eqIdx).trim());
      const val = decodeURIComponent(part.slice(eqIdx + 1).trim());
      cookies[key] = val;
    }

    const secureName  = "__Secure-next-auth.session-token";
    const regularName = "next-auth.session-token";
    const cookieName  = cookies[secureName] ? secureName : regularName;
    const tokenValue  = cookies[cookieName];

    if (!tokenValue) return null;

    try {
      const token = await decode({
        token:  tokenValue,
        secret: process.env.AUTH_SECRET!,
        salt:   cookieName,
      });
      return token?.sub ?? null;
    } catch {
      return null;
    }
  }
}

export const wsService = new WsService();
