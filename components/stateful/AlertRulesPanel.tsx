"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Spinner } from "@heroui/react";
import InfoTooltip from "@/components/ui/InfoTooltip";
import { AlertTypeBadge } from "@/components/ui/AlertBadge";
import type { AlertType } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AlertRule {
  id: string;
  ticker: string;
  ruleType: AlertType;
  threshold: number;
  cooldownMinutes: number;
}

// ── Tooltip copy ──────────────────────────────────────────────────────────────

const RULE_TOOLTIPS: Record<AlertType, { term: string; explanation: string }> = {
  price_change: {
    term: "Price Change",
    explanation: "Triggers when the stock price moves more than the threshold % within the last 5-minute candle interval — catches sudden spikes, not slow daily drifts.",
  },
  volume_spike: {
    term: "Volume Spike",
    explanation:
      "Uses z-score to detect unusual trading volume. Threshold is standard deviations above the 30-day average. 2.5σ catches ~1% of trading days.",
  },
  volatility: {
    term: "Volatility",
    explanation:
      "Annualised rolling volatility of daily log returns. Above 40% indicates a highly volatile stock.",
  },
  rsi: {
    term: "RSI",
    explanation:
      "Relative Strength Index (0–100). Above 70 = overbought (potential sell signal), below 30 = oversold (potential buy signal).",
  },
  ema_cross: {
    term: "EMA Cross",
    explanation:
      "Exponential Moving Average crossover. Triggers when the short-term EMA crosses the long-term EMA — a classic trend-change signal.",
  },
  price_level: {
    term: "Price Target",
    explanation: "Triggers when the stock price reaches a specific absolute price target you set.",
  },
};

const THRESHOLD_LABELS: Record<AlertType, string> = {
  price_change: "% move",
  volume_spike: "σ z-score",
  volatility:   "% annualised",
  rsi:          "RSI level",
  ema_cross:    "% divergence",
  price_level:  "$ price",
};

// ── System defaults (mirrors DEFAULTS in services/alerts.ts) ─────────────────

const SYSTEM_DEFAULTS: Record<AlertType, { threshold: number; cooldownMinutes: number }> = {
  price_change: { threshold: 2.0,  cooldownMinutes: 60  },
  volume_spike: { threshold: 2.5,  cooldownMinutes: 60  },
  volatility:   { threshold: 40.0, cooldownMinutes: 120 },
  rsi:          { threshold: 70.0, cooldownMinutes: 120 },
  ema_cross:    { threshold: 0,    cooldownMinutes: 240 },
  price_level:  { threshold: 0,    cooldownMinutes: 60  },
};

// Rule types that have meaningful always-on defaults (ema_cross fires on crossover
// regardless of threshold; price_level requires a user-specific target so excluded).
const AUTO_DEFAULT_TYPES: AlertType[] = ["price_change", "volume_spike", "volatility", "rsi", "ema_cross"];

// ── Sub-components ─────────────────────────────────────────────────────────────

function RuleRow({
  rule,
  onUpdate,
  onDelete,
}: {
  rule: AlertRule;
  onUpdate: (id: string, patch: Partial<Pick<AlertRule, "threshold" | "cooldownMinutes">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(rule.threshold));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const tooltip = RULE_TOOLTIPS[rule.ruleType];

  async function handleSave() {
    const val = parseFloat(draft);
    if (isNaN(val)) return;
    setSaving(true);
    await onUpdate(rule.id, { threshold: val });
    setSaving(false);
    setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete(rule.id);
    setDeleting(false);
  }

  return (
    <div
      className="rounded-xl px-3 py-3 space-y-2"
      style={{ background: "rgba(15,31,56,0.6)", border: "1px solid rgba(247,243,229,0.08)" }}
    >
      {/* Rule type + tooltip */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTypeBadge type={rule.ruleType} />
          <InfoTooltip term={tooltip.term} explanation={tooltip.explanation} />
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-text-muted hover:text-red-400 transition-colors disabled:opacity-40"
          aria-label="Delete rule"
        >
          {deleting ? (
            <Spinner size="sm" color="default" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          )}
        </button>
      </div>

      {/* Threshold */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted w-20 shrink-0">Threshold</span>
        {editing ? (
          <div className="flex items-center gap-1.5 flex-1">
            <input
              type="number"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 min-w-0 bg-navy-900 border border-navy-600 focus:border-gold-600/50 text-text-primary text-xs font-mono rounded-lg px-2 py-1 outline-none"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
            />
            <span className="text-[10px] text-text-muted shrink-0">{THRESHOLD_LABELS[rule.ruleType]}</span>
            <Button
              size="sm"
              variant="flat"
              onPress={handleSave}
              isLoading={saving}
              className="h-6 min-w-0 px-2 text-[11px] bg-gold-600/20 text-gold-400 border border-gold-600/30"
            >
              Save
            </Button>
            <button
              onClick={() => { setEditing(false); setDraft(String(rule.threshold)); }}
              className="text-text-muted hover:text-text-secondary text-[11px]"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <span className="font-mono text-xs text-text-primary">{rule.threshold}</span>
            <span className="text-[10px] text-text-muted">{THRESHOLD_LABELS[rule.ruleType]}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-text-muted hover:text-gold-400 transition-colors ml-1"
              aria-label="Edit threshold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Cooldown */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted w-20 shrink-0">Cooldown</span>
        <span className="font-mono text-xs text-text-secondary">{rule.cooldownMinutes} min</span>
      </div>
    </div>
  );
}

// ── Default Rule Row (system default, no DB entry yet) ────────────────────────

function DefaultRuleRow({
  ruleType,
  onCustomize,
  onDismiss,
}: {
  ruleType:    AlertType;
  onCustomize: (ruleType: AlertType) => void;
  onDismiss:   (ruleType: AlertType) => void;
}) {
  const tooltip  = RULE_TOOLTIPS[ruleType];
  const defaults = SYSTEM_DEFAULTS[ruleType];

  return (
    <div
      className="rounded-xl px-3 py-3 space-y-2"
      style={{ background: "rgba(15,31,56,0.6)", border: "1px solid rgba(247,243,229,0.08)" }}
    >
      {/* Rule type + tooltip + default badge + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTypeBadge type={ruleType} />
          <InfoTooltip term={tooltip.term} explanation={tooltip.explanation} />
          <span
            className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: "rgba(247,243,229,0.07)", color: "#9DA5B4" }}
          >
            Default
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Customize (edit) */}
          <button
            onClick={() => onCustomize(ruleType)}
            className="text-text-muted hover:text-gold-400 transition-colors"
            aria-label="Customize rule"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          {/* Dismiss */}
          <button
            onClick={() => onDismiss(ruleType)}
            className="text-text-muted hover:text-red-400 transition-colors"
            aria-label="Dismiss rule"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Threshold */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted w-20 shrink-0">Threshold</span>
        <span className="font-mono text-xs text-text-primary">
          {ruleType === "ema_cross" ? "crossover signal" : `${defaults.threshold} ${THRESHOLD_LABELS[ruleType]}`}
        </span>
      </div>

      {/* Cooldown */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-text-muted w-20 shrink-0">Cooldown</span>
        <span className="font-mono text-xs text-text-primary">{defaults.cooldownMinutes} min</span>
      </div>
    </div>
  );
}

// ── Add Custom Rule Form ──────────────────────────────────────────────────────

const ALL_RULE_TYPES: AlertType[] = ["price_change", "volume_spike", "volatility", "rsi", "ema_cross", "price_level"];

function AddRuleForm({
  ticker,
  onAdd,
  onCancel,
  prefill,
}: {
  ticker: string;
  onAdd: (rule: Omit<AlertRule, "id">) => Promise<void>;
  onCancel: () => void;
  prefill?: { ruleType: AlertType; threshold: number; cooldownMinutes: number };
}) {
  const [ruleType, setRuleType] = useState<AlertType>(prefill?.ruleType ?? "rsi");
  const [threshold, setThreshold] = useState(String(prefill?.threshold ?? 70));
  const [cooldown, setCooldown] = useState(String(prefill?.cooldownMinutes ?? 60));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const t = parseFloat(threshold);
    const c = parseInt(cooldown, 10);
    if (isNaN(t) || isNaN(c) || c < 1) {
      setError("Enter valid threshold and cooldown.");
      return;
    }
    setSaving(true);
    setError(null);
    await onAdd({ ticker, ruleType, threshold: t, cooldownMinutes: c });
    setSaving(false);
  }

  return (
    <div
      className="rounded-xl px-3 py-3 space-y-3"
      style={{ background: "rgba(15,31,56,0.6)", border: "1px solid rgba(247,243,229,0.15)" }}
    >
      <p className="text-xs text-gold-400 font-medium">New Rule</p>

      {/* Rule type */}
      <div className="space-y-1">
        <label className="text-[11px] text-text-muted">Type</label>
        <select
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value as AlertType)}
          className="w-full bg-navy-900 border border-navy-600 text-text-secondary text-xs rounded-lg px-2 py-1.5 outline-none"
        >
          {ALL_RULE_TYPES.map((t) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
      </div>

      {/* Threshold */}
      <div className="space-y-1">
        <label className="text-[11px] text-text-muted">
          Threshold <span className="text-text-muted/60">({THRESHOLD_LABELS[ruleType]})</span>
        </label>
        <input
          type="number"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="w-full bg-navy-900 border border-navy-600 focus:border-gold-600/50 text-text-primary text-xs font-mono rounded-lg px-2 py-1.5 outline-none"
        />
      </div>

      {/* Cooldown */}
      <div className="space-y-1">
        <label className="text-[11px] text-text-muted">Cooldown (minutes)</label>
        <input
          type="number"
          value={cooldown}
          onChange={(e) => setCooldown(e.target.value)}
          className="w-full bg-navy-900 border border-navy-600 focus:border-gold-600/50 text-text-primary text-xs font-mono rounded-lg px-2 py-1.5 outline-none"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="flat"
          onPress={handleSubmit}
          isLoading={saving}
          className="h-7 text-xs bg-gold-600/20 text-gold-400 border border-gold-600/30"
        >
          Add Rule
        </Button>
        <button onClick={onCancel} className="text-xs text-text-muted hover:text-text-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────────────────────────

interface AlertRulesPanelProps {
  ticker: string | null;
  onClose: () => void;
}

export default function AlertRulesPanel({ ticker, onClose }: AlertRulesPanelProps) {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormPrefill, setAddFormPrefill] = useState<
    { ruleType: AlertType; threshold: number; cooldownMinutes: number } | undefined
  >(undefined);
  const [dismissedDefaults, setDismissedDefaults] = useState<Set<AlertType>>(new Set());

  const load = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/alerts/rules");
      if (!res.ok) return;
      const all: AlertRule[] = await res.json();
      setRules(all.filter((r) => r.ticker === t));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ticker) {
      setRules([]);
      setShowAddForm(false);
      setAddFormPrefill(undefined);
      setDismissedDefaults(new Set());
      load(ticker);
    }
  }, [ticker, load]);

  function handleDismissDefault(ruleType: AlertType) {
    setDismissedDefaults((prev) => new Set([...prev, ruleType]));
  }

  function handleCustomizeDefault(ruleType: AlertType) {
    const defaults = SYSTEM_DEFAULTS[ruleType];
    setAddFormPrefill({ ruleType, threshold: defaults.threshold, cooldownMinutes: defaults.cooldownMinutes });
    setShowAddForm(true);
  }

  async function handleUpdate(id: string, patch: Partial<Pick<AlertRule, "threshold" | "cooldownMinutes">>) {
    try {
      await fetch(`/api/v1/alerts/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    } catch {
      // silently fail
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/v1/alerts/rules/${id}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // silently fail
    }
  }

  async function handleAdd(rule: Omit<AlertRule, "id">) {
    try {
      const res = await fetch("/api/v1/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!res.ok) return;
      const created: AlertRule = await res.json();
      setRules((prev) => [...prev, created]);
      setShowAddForm(false);
    } catch {
      // silently fail
    }
  }

  const isOpen = ticker !== null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30"
          style={{ background: "rgba(5,13,26,0.4)" }}
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className="fixed top-0 right-0 h-full w-80 z-40 flex flex-col transition-transform duration-300 ease-in-out"
        style={{
          background: "rgba(10,22,40,0.98)",
          borderLeft: "1px solid rgba(247,243,229,0.12)",
          backdropFilter: "blur(16px)",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4 border-b"
          style={{ borderColor: "rgba(247,243,229,0.08)" }}
        >
          <div>
            <p className="text-[11px] text-text-muted uppercase tracking-wider mb-0.5">Alert Rules</p>
            <p className="font-mono text-base font-medium text-gold-400">{ticker ?? "—"}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
            style={{ background: "rgba(247,243,229,0.06)" }}
            aria-label="Close panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner size="sm" color="default" />
            </div>
          ) : (
            <>
              {/* User-defined rules */}
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}

              {/* System defaults for rule types the user hasn't overridden or dismissed */}
              {!showAddForm && (() => {
                const customisedTypes = new Set(rules.map((r) => r.ruleType));
                const defaultsToShow = AUTO_DEFAULT_TYPES.filter(
                  (t) => !customisedTypes.has(t) && !dismissedDefaults.has(t)
                );
                if (defaultsToShow.length === 0) return null;
                return (
                  <>
                    {rules.length > 0 && (
                      <p className="text-[10px] text-text-muted uppercase tracking-wider pt-1">System defaults</p>
                    )}
                    {defaultsToShow.map((t) => (
                      <DefaultRuleRow
                        key={t}
                        ruleType={t}
                        onCustomize={handleCustomizeDefault}
                        onDismiss={handleDismissDefault}
                      />
                    ))}
                  </>
                );
              })()}

              {/* Add custom rule button */}
              {!showAddForm && (
                <button
                  onClick={() => { setAddFormPrefill(undefined); setShowAddForm(true); }}
                  className="w-full rounded-xl px-3 py-2.5 text-xs text-text-muted hover:text-gold-400 transition-colors text-left border border-dashed"
                  style={{ borderColor: "rgba(247,243,229,0.12)" }}
                >
                  + Add custom rule
                </button>
              )}

              {showAddForm && ticker && (
                <AddRuleForm
                  ticker={ticker}
                  onAdd={handleAdd}
                  onCancel={() => { setShowAddForm(false); setAddFormPrefill(undefined); }}
                  prefill={addFormPrefill}
                />
              )}
            </>
          )}
        </div>

      </aside>
    </>
  );
}
