"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "⬡" },
  { href: "/watchlist", label: "Watchlist", icon: "◈" },
  { href: "/alerts", label: "Alerts", icon: "◉" },
  { href: "/news", label: "News", icon: "◎" },
  { href: "/signals", label: "Signals", icon: "◆" },
  { href: "/portfolio", label: "Portfolio", icon: "◇" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 flex flex-col border-r"
      style={{
        background: "rgba(5, 13, 26, 0.95)",
        borderColor: "rgba(247,243,229,0.1)",
      }}
    >
      {/* Brand */}
      <div className="px-6 py-8 border-b text-center" style={{ borderColor: "rgba(247,243,229,0.1)" }}>
        <span
          className="font-display text-3xl text-gold-400 block"
          style={{ textShadow: "0 0 20px rgba(247,243,229,0.3)" }}
        >
          Acrue
        </span>
        <p className="text-xs tracking-[0.2em] uppercase mt-1.5" style={{ color: "rgba(247,243,229,0.35)" }}>
          Invest with clarity
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200"
              style={{
                color: active ? "#d4ccae" : "#a0abbe",
                background: active ? "rgba(247,243,229,0.08)" : "transparent",
                boxShadow: active ? "inset 0 0 0 1px rgba(247,243,229,0.15)" : "none",
              }}
            >
              <span className="text-base w-5 text-center">{icon}</span>
              <span className="tracking-wide">{label}</span>
              {active && (
                <span
                  className="ml-auto w-1 h-4 rounded-full"
                  style={{
                    background: "#d4ccae",
                    boxShadow: "0 0 8px rgba(247,243,229,0.8)",
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t" style={{ borderColor: "rgba(247,243,229,0.1)" }}>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full text-left text-text-muted hover:text-text-secondary transition-colors"
        >
          <span className="text-base w-5 text-center">→</span>
          Sign out
        </button>
      </div>
    </aside>
  );
}
