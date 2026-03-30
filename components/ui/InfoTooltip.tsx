"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  term: string;
  explanation: string;
}

export default function InfoTooltip({ term, explanation }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const iconRef = useRef<SVGSVGElement>(null);

  function show() {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top + window.scrollY - 8,   // 8px gap above icon
      left: rect.left + rect.width / 2 + window.scrollX,
    });
    setVisible(true);
  }

  function hide() {
    setVisible(false);
  }

  // Hide on scroll so the tooltip doesn't float detached
  useEffect(() => {
    if (!visible) return;
    window.addEventListener("scroll", hide, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", hide, { capture: true });
  }, [visible]);

  return (
    <span className="inline-flex items-center" aria-label={`Info: ${term}`}>
      <svg
        ref={iconRef}
        xmlns="http://www.w3.org/2000/svg"
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-text-muted hover:text-text-secondary transition-colors cursor-help"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>

      {visible && typeof document !== "undefined" && createPortal(
        <span
          className="pointer-events-none fixed z-[9999] w-64 px-3 py-2 rounded-lg text-xs leading-relaxed"
          style={{
            top: coords.top,
            left: coords.left,
            transform: "translate(-50%, -100%)",
            background: "rgba(10,22,40,0.97)",
            border: "1px solid rgba(247,243,229,0.15)",
            color: "#a0abbe",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          <span className="block font-medium text-gold-400 mb-0.5 font-mono text-[11px] uppercase tracking-wider">
            {term}
          </span>
          {explanation}
          {/* Arrow */}
          <span
            className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 rotate-45"
            style={{
              background: "rgba(10,22,40,0.97)",
              borderRight: "1px solid rgba(247,243,229,0.15)",
              borderBottom: "1px solid rgba(247,243,229,0.15)",
              marginTop: "-5px",
            }}
          />
        </span>,
        document.body
      )}
    </span>
  );
}
