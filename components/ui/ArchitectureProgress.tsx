"use client";

import { useEffect, useState } from "react";

export const ARCH_SECTIONS = [
  { id: "arch-overview",   label: "System Overview"     },
  { id: "arch-queue",      label: "Priority Queue"      },
  { id: "arch-scheduler",  label: "Ticker Scheduler"    },
  { id: "arch-search",     label: "Search & Recommender"},
  { id: "arch-alerts",     label: "Alert Detection"     },
  { id: "arch-news",       label: "News Pipeline"       },
  { id: "arch-signals",    label: "Signal Scoring"      },
  { id: "arch-portfolio",  label: "Portfolio MPT"       },
  { id: "arch-websocket",  label: "WebSocket"           },
  { id: "arch-database",   label: "Database Design"     },
  { id: "arch-frontend",   label: "Frontend"            },
  { id: "arch-deployment", label: "Deployment"          },
];

export default function ArchitectureProgress() {
  const [scrollPct, setScrollPct]     = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Scroll progress bar
  useEffect(() => {
    function onScroll() {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollPct(max > 0 ? Math.min((window.scrollY / max) * 100, 100) : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section: whichever section top is closest to (but above) 40% down the viewport
  useEffect(() => {
    function updateActive() {
      const trigger = window.scrollY + window.innerHeight * 0.4;
      let bestIndex = 0;
      let bestDist  = Infinity;

      ARCH_SECTIONS.forEach(({ id }, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const elTop = el.getBoundingClientRect().top + window.scrollY;
        if (elTop <= trigger) {
          const dist = trigger - elTop;
          if (dist < bestDist) { bestDist = dist; bestIndex = i; }
        }
      });

      setActiveIndex(bestIndex);
    }

    window.addEventListener("scroll", updateActive, { passive: true });
    updateActive();
    return () => window.removeEventListener("scroll", updateActive);
  }, []);

  const current = activeIndex + 1;
  const total   = ARCH_SECTIONS.length;

  return (
    <>
      {/* ── Top progress bar ── */}
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{ height: 3, background: "rgba(5,13,26,0.9)" }}
      >
        <div
          style={{
            height: "100%",
            width: `${scrollPct}%`,
            background: "linear-gradient(90deg, #d4ccae, #f7f3e5)",
            boxShadow: "0 0 10px rgba(247,243,229,0.5)",
            transition: "width 0.1s linear",
          }}
        />
      </div>

      {/* ── Section counter pill (top-right) ── */}
      <div
        className="fixed top-5 right-5 z-50 hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs"
        style={{
          background: "rgba(10,22,40,0.88)",
          border: "1px solid rgba(247,243,229,0.14)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        <span style={{ color: "#d4ccae", fontWeight: 700 }}>{current}</span>
        <span style={{ color: "rgba(247,243,229,0.25)" }}>/</span>
        <span style={{ color: "rgba(247,243,229,0.5)" }}>{total}</span>
      </div>

      {/* ── Floating TOC (right side, xl screens) ── */}
      <nav
        className="fixed top-1/2 -translate-y-1/2 right-5 z-40 hidden xl:flex flex-col gap-1"
        aria-label="Page sections"
      >
        {ARCH_SECTIONS.map(({ id, label }, i) => {
          const isActive = i === activeIndex;
          return (
            <button
              key={id}
              onClick={() =>
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className="flex items-center gap-2.5 group text-left"
              style={{ padding: "3px 0" }}
            >
              {/* Dot */}
              <span
                style={{
                  flexShrink: 0,
                  width: isActive ? 8 : 5,
                  height: isActive ? 8 : 5,
                  borderRadius: "50%",
                  background: isActive ? "#d4ccae" : "rgba(247,243,229,0.18)",
                  boxShadow: isActive ? "0 0 8px rgba(247,243,229,0.7)" : "none",
                  transition: "all 0.2s ease",
                }}
              />
              {/* Label */}
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono), monospace",
                  color: isActive ? "#d4ccae" : "rgba(247,243,229,0.28)",
                  transition: "color 0.2s ease",
                  whiteSpace: "nowrap",
                }}
                className="group-hover:!text-gold-400"
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
