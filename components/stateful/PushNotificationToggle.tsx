"use client";

import { useState, useEffect } from "react";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

/**
 * Opt-in toggle for browser push notifications.
 *
 * Flow:
 *   1. Registers the service worker (/sw.js) if not already registered.
 *   2. Requests Notification permission from the browser.
 *   3. Calls PushManager.subscribe() with the VAPID public key.
 *   4. POSTs the subscription object to the server so it can send pushes.
 *
 * Unsubscribe flow:
 *   1. Calls subscription.unsubscribe() in the browser.
 *   2. DELETEs the subscription from the server.
 *
 * Only rendered if the browser supports Service Workers + Push API.
 * Shows nothing when permission is "denied" (user must re-enable in browser settings).
 */
export default function PushNotificationToggle() {
  const [permission,    setPermission]    = useState<PermissionState>("default");
  const [subscribed,    setSubscribed]    = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [testing,       setTesting]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  // On mount: check current permission + whether already subscribed
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PermissionState);

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setSubscribed(!!sub);
      });
    }).catch(() => {});
  }, []);

  if (permission === "unsupported" || permission === "denied") return null;

  async function handleEnable() {
    setLoading(true);
    setError(null);
    try {
      // Register SW
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);
      if (result !== "granted") {
        setError("Permission denied. Enable notifications in your browser settings.");
        return;
      }

      // Subscribe via PushManager
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ).buffer as ArrayBuffer,
      });

      // Save to server
      const res = await fetch("/api/v1/notifications/push/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("Server rejected subscription.");

      setSubscribed(true);
    } catch (e) {
      setError((e as Error).message ?? "Failed to enable notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisable() {
    setLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Remove from server first
        await fetch("/api/v1/notifications/push/subscribe", {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      setError((e as Error).message ?? "Failed to disable notifications.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    try {
      const res  = await fetch("/api/v1/notifications/push/test", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(`Server error: ${data.message ?? res.statusText}`);
        return;
      }
      if (data.error === "no_subscription") {
        setError("No subscription found. Try disabling and re-enabling push alerts.");
        return;
      }
      if (data.errors?.length > 0) {
        setError(`Push failed: ${data.errors[0]}`);
        return;
      }
      if (!data.sent) {
        setError("Notification not delivered — check browser/OS notification settings.");
      }
    } catch (e) {
      setError((e as Error).message ?? "Failed to send test notification.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={subscribed ? handleDisable : handleEnable}
        disabled={loading}
        className={`
          flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-medium
          border transition-all disabled:opacity-50
          ${subscribed
            ? "bg-gold-600/10 border-gold-600/30 text-gold-400 hover:bg-gold-600/20"
            : "bg-navy-700 border-navy-600 text-text-secondary hover:border-navy-500 hover:text-text-primary"
          }
        `}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : subscribed ? (
          <BellOnIcon />
        ) : (
          <BellOffIcon />
        )}
        <span>
          {loading
            ? subscribed ? "Disabling…" : "Enabling…"
            : subscribed
              ? "Push alerts on"
              : "Enable push alerts"
          }
        </span>
        {subscribed && (
          <span
            className="ml-auto text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
            style={{ background: "rgba(247,243,229,0.12)", color: "#f7f3e5" }}
          >
            High only
          </span>
        )}
      </button>

      {subscribed && !loading && (
        <div className="flex items-center gap-3 px-1">
          <p className="text-[11px] text-text-muted">
            You&apos;ll get a browser notification for every high-severity alert, even with the tab closed.
          </p>
          <button
            onClick={handleTest}
            disabled={testing}
            className="shrink-0 text-[11px] text-text-muted hover:text-gold-400 underline underline-offset-2 transition-colors disabled:opacity-50"
          >
            {testing ? "Sending…" : "Send test"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-400 px-1">{error}</p>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function BellOnIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <circle cx="19" cy="5" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Converts a base64url-encoded VAPID public key string to a Uint8Array
 * as required by PushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData  = window.atob(base64);
  const output   = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}
