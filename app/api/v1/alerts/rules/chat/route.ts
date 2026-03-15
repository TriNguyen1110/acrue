import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiError, ApiAuthError } from "@/lib/apiAuth";
import { createAlertRule, DuplicateRuleError } from "@/services/alerts";
import type { AlertType } from "@/types";

// ── Rule-type keyword maps ────────────────────────────────────────────────────

const RULE_TYPE_KEYWORDS: Array<{ ruleType: AlertType; keywords: string[] }> = [
  {
    ruleType: "volume_spike",
    keywords: ["volume", "spike", "trading volume"],
  },
  {
    ruleType: "volatility",
    keywords: ["volatile", "volatility"],
  },
  {
    ruleType: "rsi",
    keywords: ["rsi", "overbought", "oversold", "relative strength"],
  },
  {
    ruleType: "ema_cross",
    keywords: ["ema", "crossover", "cross", "moving average"],
  },
  {
    ruleType: "price_level",
    keywords: ["hits", "reaches", "crosses above", "breaks above", "breaks below", "target"],
  },
  {
    ruleType: "price_change",
    keywords: ["moves", "drops", "falls", "rises", "gains", "changes", "price change", "percent", "%"],
  },
];

// Default thresholds / cooldowns per rule type when the user doesn't specify a number
const CHAT_DEFAULTS: Record<AlertType, { threshold: number; cooldownMinutes: number }> = {
  price_change: { threshold: 5,    cooldownMinutes: 60 },
  volume_spike: { threshold: 2.5,  cooldownMinutes: 60 },
  volatility:   { threshold: 40,   cooldownMinutes: 120 },
  rsi:          { threshold: 70,   cooldownMinutes: 120 },
  ema_cross:    { threshold: 0,    cooldownMinutes: 240 },
  price_level:  { threshold: 0,    cooldownMinutes: 60 },
};

// ── Confirmation message builders ────────────────────────────────────────────

function buildConfirmation(ticker: string, ruleType: AlertType, threshold: number): string {
  switch (ruleType) {
    case "price_change":
      return `Got it — I'll alert you when ${ticker} moves more than ${threshold}%.`;
    case "volume_spike":
      return `Got it — I'll alert you when ${ticker} volume spikes above ${threshold}x the average.`;
    case "volatility":
      return `Got it — I'll alert you when ${ticker} annualised volatility exceeds ${threshold}%.`;
    case "rsi":
      return `Got it — I'll alert you when ${ticker} RSI reaches ${threshold}.`;
    case "ema_cross":
      return `Got it — I'll alert you when ${ticker} has an EMA crossover.`;
    case "price_level":
      return threshold > 0
        ? `Got it — I'll alert you when ${ticker} hits $${threshold}.`
        : `Got it — I'll alert you on a ${ticker} price-level crossover.`;
    default:
      return `Got it — I'll alert you when ${ticker} triggers a ${ruleType} alert.`;
  }
}

// ── Parser ────────────────────────────────────────────────────────────────────

interface ParsedRule {
  ticker: string;
  ruleType: AlertType;
  threshold: number;
  cooldownMinutes: number;
}

function parseNaturalLanguage(input: string): ParsedRule | null {
  const upper = input.toUpperCase();
  const lower = input.toLowerCase();

  // Extract ticker — first word-boundary sequence of 1-5 uppercase letters
  const tickerMatch = upper.match(/\b([A-Z]{1,5})\b/);
  if (!tickerMatch) return null;
  const ticker = tickerMatch[1];

  // Extract numeric value — first occurrence of digits (with optional decimal)
  const numberMatch = input.match(/(\d+\.?\d*)/);
  const extractedNumber = numberMatch ? parseFloat(numberMatch[1]) : null;

  // Detect rule type by longest keyword match (multi-word keywords checked first)
  let detectedType: AlertType | null = null;
  for (const { ruleType, keywords } of RULE_TYPE_KEYWORDS) {
    // Sort keywords by length descending so multi-word phrases are tested first
    const sorted = [...keywords].sort((a, b) => b.length - a.length);
    if (sorted.some((kw) => lower.includes(kw))) {
      detectedType = ruleType;
      break;
    }
  }

  if (!detectedType) {
    // Default to price_change when no rule-type keywords are matched
    detectedType = "price_change";
  }

  const defaults = CHAT_DEFAULTS[detectedType];
  const threshold = extractedNumber !== null ? extractedNumber : defaults.threshold;

  return {
    ticker,
    ruleType: detectedType,
    threshold,
    cooldownMinutes: defaults.cooldownMinutes,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    const message: string = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return apiError("validation_error", "message is required.", 400);
    }

    const parsed = parseNaturalLanguage(message);

    if (!parsed) {
      return NextResponse.json(
        {
          error: "parse_failed",
          message: "I couldn't understand that. Try: 'Alert me when AAPL drops more than 5%'",
        },
        { status: 422 }
      );
    }

    const rule = await createAlertRule(user.id, parsed);
    const confirmation = buildConfirmation(parsed.ticker, parsed.ruleType, parsed.threshold);

    return NextResponse.json({ rule, message: confirmation }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiAuthError)     return apiError("unauthorized", "Authentication required.", 401);
    if (e instanceof DuplicateRuleError) return apiError("conflict", e.message, 409);
    console.error(e);
    return apiError("internal_error", "Failed to create alert rule.", 500);
  }
}
