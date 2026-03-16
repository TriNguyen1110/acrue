"use client";

// ── SentimentBadge ────────────────────────────────────────────────────────────
//
// Stateless pill badge displaying the sentiment label of a news article.
// Follows the same style as AlertBadge — small pill with colored dot.
//
// Props:
//   sentiment — "positive" | "neutral" | "negative" | null
//   size      — "sm" (default) | "md"

type Sentiment = "positive" | "neutral" | "negative";

interface SentimentBadgeProps {
  sentiment: Sentiment | null;
  size?: "sm" | "md";
}

const SENTIMENT_CONFIG: Record<
  Sentiment,
  { label: string; dotColor: string; textColor: string; borderColor: string; bgColor: string }
> = {
  positive: {
    label:       "Positive",
    dotColor:    "bg-emerald-400",
    textColor:   "text-emerald-400",
    borderColor: "rgba(52,211,153,0.25)",
    bgColor:     "rgba(52,211,153,0.08)",
  },
  negative: {
    label:       "Negative",
    dotColor:    "bg-rose-400",
    textColor:   "text-rose-400",
    borderColor: "rgba(251,113,133,0.25)",
    bgColor:     "rgba(251,113,133,0.08)",
  },
  neutral: {
    label:       "Neutral",
    dotColor:    "bg-text-muted",
    textColor:   "text-text-muted",
    borderColor: "rgba(92,104,128,0.3)",
    bgColor:     "rgba(92,104,128,0.08)",
  },
};

export function SentimentBadge({ sentiment, size = "sm" }: SentimentBadgeProps) {
  if (!sentiment) return null;

  const cfg = SENTIMENT_CONFIG[sentiment];

  const dotSize  = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const textSize = size === "sm" ? "text-[10px]"  : "text-xs";
  const padding  = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border font-medium whitespace-nowrap ${textSize} ${padding} ${cfg.textColor}`}
      style={{ background: cfg.bgColor, borderColor: cfg.borderColor }}
    >
      <span className={`rounded-full shrink-0 ${dotSize} ${cfg.dotColor}`} />
      {cfg.label}
    </span>
  );
}

export default SentimentBadge;
