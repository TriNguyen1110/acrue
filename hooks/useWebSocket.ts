"use client";

import { useEffect, useLayoutEffect, useRef, useCallback } from "react";

// ── Message types sent from server → client ───────────────────────────────────

export type WsQuoteMessage = {
  type: "quote";
  ticker: string;
  price: number;
  changePct: number;
  volume: number;
};

export type WsAlertMessage = {
  type: "alert";
  id: string;
  ticker: string;
  alertType: string;
  message: string;
  severity: string;
  triggeredAt: string;
};

export type WsSubscribedMessage = {
  type: "subscribed";
  tickers: string[];
};

export type WsServerMessage =
  | WsQuoteMessage
  | WsAlertMessage
  | WsSubscribedMessage
  | { type: "pong" }
  | { type: "error"; message: string };

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Connects to the WS server at /ws and calls `onMessage` for every message
 * received. Reconnects automatically with a 3-second delay after close/error.
 *
 * Keeps a heartbeat ping every 30s to prevent idle-timeout disconnects.
 *
 * Usage:
 *   useWebSocket((msg) => {
 *     if (msg.type === "quote") updatePrice(msg.ticker, msg.price);
 *     if (msg.type === "alert") prependAlert(msg);
 *   });
 */
export function useWebSocket(onMessage: (msg: WsServerMessage) => void): void {
  const wsRef              = useRef<WebSocket | null>(null);
  const reconnectTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const onMessageRef = useRef(onMessage);
  const connectRef   = useRef<() => void>(() => {});

  useLayoutEffect(() => { onMessageRef.current = onMessage; });

  const connect = useCallback(() => {
    // Don't open a second connection if one is already alive
    if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      // Heartbeat — keeps the connection alive through idle-close proxies
      pingTimerRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30_000);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as WsServerMessage;
        onMessageRef.current(msg);
      } catch {
        // ignore parse errors
      }
    };

    const cleanup = () => {
      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
      wsRef.current = null;
      // Reconnect after 3s
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), 3_000);
    };

    ws.onclose = cleanup;
    ws.onerror = () => ws.close();
  }, []);

  useLayoutEffect(() => { connectRef.current = connect; });

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current)      clearInterval(pingTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);
}
