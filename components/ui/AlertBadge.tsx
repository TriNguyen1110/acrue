import { Chip } from "@heroui/react";
import type { AlertSeverity, AlertType } from "@/types";

// ── Severity Badge ─────────────────────────────────────────────────────────────

interface AlertBadgeProps {
  severity: AlertSeverity;
  size?: "sm" | "md";
}

const SEVERITY_CONFIG: Record<
  AlertSeverity,
  { label: string; color: "danger" | "warning" | "primary" }
> = {
  high:   { label: "High",   color: "danger"  },
  medium: { label: "Medium", color: "warning" },
  low:    { label: "Low",    color: "primary" },
};

export function AlertBadge({ severity, size = "sm" }: AlertBadgeProps) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <Chip
      size="sm"
      variant="flat"
      color={cfg.color}
      classNames={{
        base: size === "sm" ? "h-5" : "h-6",
        content: size === "sm" ? "text-[10px] font-medium px-1" : "text-xs font-medium px-1.5",
      }}
    >
      {cfg.label}
    </Chip>
  );
}

// ── Alert Type Badge ───────────────────────────────────────────────────────────

interface AlertTypeBadgeProps {
  type: AlertType;
  size?: "sm" | "md";
}

const TYPE_CONFIG: Record<AlertType, { label: string; icon: string }> = {
  price_change: { label: "Price",      icon: "↕" },
  volume_spike: { label: "Volume",     icon: "⬆" },
  volatility:   { label: "Volatility", icon: "~" },
  rsi:          { label: "RSI",        icon: "" },
  ema_cross:    { label: "EMA Cross",  icon: "" },
  price_level:  { label: "Price Target", icon: "⊕" },
};

export function AlertTypeBadge({ type, size = "sm" }: AlertTypeBadgeProps) {
  const cfg = TYPE_CONFIG[type];
  const icon = cfg.icon ? `${cfg.icon} ` : "";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-mono whitespace-nowrap ${
        size === "sm"
          ? "text-[10px] px-1.5 py-0.5"
          : "text-xs px-2 py-0.5"
      }`}
      style={{
        background: "rgba(247,243,229,0.06)",
        borderColor: "rgba(247,243,229,0.15)",
        color: "#a0abbe",
      }}
    >
      {icon}{cfg.label}
    </span>
  );
}

export default AlertBadge;
