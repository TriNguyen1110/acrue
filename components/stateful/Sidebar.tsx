"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useState, useEffect } from "react";

const NAV = [
  { href: "/dashboard",   label: "Dashboard",  icon: "⊞" },  // grid overview
  { href: "/watchlist",   label: "Watchlist",  icon: "★" },  // starred/watched
  { href: "/alerts",      label: "Alerts",     icon: "⚑" },  // flag = flagged/alert
  { href: "/news",        label: "News",       icon: "☰" },  // lines = feed/newspaper
  { href: "/signals",     label: "Signals",    icon: "↗" },  // trending up
  { href: "/portfolio",   label: "Portfolio",  icon: "⊕" },  // holdings/positions
  { href: "/simulate",    label: "Simulate",   icon: "⟳" },  // replay/test scenarios
  { href: "/how-to-use",  label: "Guide",      icon: "?" },  // how-to / onboarding
];

function useUnreadAlerts() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetch_() {
      try {
        const res = await fetch("/api/v1/alerts/unread");
        if (!res.ok) return;
        const data = await res.json();
        setCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        // silently fail — badge just shows nothing
      }
    }

    fetch_();
    const interval = setInterval(fetch_, 60_000);
    return () => clearInterval(interval);
  }, []);

  return count;
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold leading-none"
      style={{
        background: "#ef4444",
        color: "#fff",
        boxShadow: "0 0 8px rgba(239,68,68,0.5)",
        padding: "0 4px",
      }}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const unreadAlerts = useUnreadAlerts();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 flex flex-col border-r"
      style={{
        background: "rgba(5, 13, 26, 0.92)",
        borderColor: "rgba(247,243,229,0.1)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
      }}
    >
      {/* Brand */}
      <div className="px-6 py-8 border-b text-center" style={{ borderColor: "rgba(247,243,229,0.1)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="Acrue logo"
          className="mx-auto"
          style={{ width: 96, height: 48, objectFit: "contain", filter: "drop-shadow(0 0 8px rgba(247,243,229,0.25))" }}
        />
        <span
          className="font-display text-3xl text-gold-400 block"
          style={{ textShadow: "0 0 20px rgba(247,243,229,0.3)" }}
        >
          Acrue
        </span>
        <p className="text-xs tracking-[0.2em] uppercase mt-1.5" style={{ color: "rgba(247,243,229,0.35)" }}>
          Built to Accrue
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href;
          const isAlerts = href === "/alerts";

          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:text-gold-400 btn-nudge"
              style={{
                color: active ? "#f7f3e5" : "#a0abbe",
                background: active
                  ? "linear-gradient(90deg, rgba(247,243,229,0.1) 0%, rgba(247,243,229,0.04) 100%)"
                  : "transparent",
                boxShadow: active
                  ? "inset 0 0 0 1px rgba(247,243,229,0.18), 0 0 20px rgba(247,243,229,0.04)"
                  : "none",
              }}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              <span className="tracking-wide">{label}</span>

              {/* Unread badge on Alerts */}
              {isAlerts && !active && (
                <UnreadBadge count={unreadAlerts} />
              )}

              {/* Active indicator bar */}
              {active && (
                <>
                  {/* Still show badge even when active */}
                  {isAlerts && <UnreadBadge count={unreadAlerts} />}
                  <span
                    className="ml-auto w-1 h-5 rounded-full"
                    style={{
                      background: "linear-gradient(180deg, #f7f3e5, #d4ccae)",
                      boxShadow: "0 0 6px rgba(247,243,229,0.8), 0 0 14px rgba(247,243,229,0.5)",
                      animation: "indicatorPulse 2.5s ease-in-out infinite",
                    }}
                  />
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out + architecture link */}
      <div className="px-3 py-4 border-t space-y-0.5" style={{ borderColor: "rgba(247,243,229,0.1)" }}>
        <Link
          href="/architecture"
          className="btn-nudge flex items-center gap-3 px-3 py-2 rounded-xl text-xs w-full text-text-muted hover:text-gold-400 transition-colors"
        >
          <span className="text-sm w-5 text-center opacity-60">⬡</span>
          Architecture
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-nudge flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full text-left text-text-muted hover:text-text-secondary transition-colors"
        >
          <span className="text-base w-5 text-center">→</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
