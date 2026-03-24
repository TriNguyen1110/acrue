"use client";

import { useState } from "react";

export default function ExpandableCard({
  id,
  icon,
  title,
  accent,
  summary,
  detail,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  accent: string;
  summary: React.ReactNode;
  detail: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      id={id}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(10, 22, 40, 0.65)",
        border: "1px solid rgba(247,243,229,0.1)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(247,243,229,0.06)",
      }}
    >
      {/* Accent bar */}
      <div className="h-[2px] w-full" style={{ background: accent }} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span style={{ color: "rgba(247,243,229,0.7)" }}>{icon}</span>
            <h2
              className="font-display text-lg text-gold-400"
              style={{ textShadow: "0 0 16px rgba(247,243,229,0.2)" }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-mono transition-colors"
            style={{
              borderColor: open ? "rgba(247,243,229,0.25)" : "rgba(247,243,229,0.1)",
              color: open ? "rgba(247,243,229,0.8)" : "rgba(247,243,229,0.4)",
            }}
          >
            {open ? "Collapse" : "Expand"}
            <span
              style={{
                display: "inline-block",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s ease",
              }}
            >
              ↓
            </span>
          </button>
        </div>

        {/* Summary — always visible */}
        <div className="text-sm text-text-secondary leading-relaxed space-y-3">
          {summary}
        </div>

        {/* Detail — shown when expanded */}
        {open && (
          <div
            className="mt-5 pt-5 space-y-4 text-sm text-text-secondary leading-relaxed"
            style={{ borderTop: "1px solid rgba(247,243,229,0.07)" }}
          >
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
