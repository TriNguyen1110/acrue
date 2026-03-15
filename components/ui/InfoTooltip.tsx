interface InfoTooltipProps {
  term: string;
  explanation: string;
}

export default function InfoTooltip({ term, explanation }: InfoTooltipProps) {
  return (
    <span className="relative group inline-flex items-center" aria-label={`Info: ${term}`}>
      <svg
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
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      {/* Tooltip */}
      <span
        className="pointer-events-none absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-50
          w-64 px-3 py-2 rounded-lg text-xs leading-relaxed
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150"
        style={{
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
      </span>
    </span>
  );
}
