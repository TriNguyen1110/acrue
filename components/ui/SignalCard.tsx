import type { SignalScore, ConfidenceLevel, SignalDirection } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null, suffix = "", fallback = "—"): string {
  if (n === null) return fallback;
  return `${n > 0 ? "+" : ""}${n}${suffix}`;
}

function fmtAbs(n: number | null, suffix = "", fallback = "—"): string {
  if (n === null) return fallback;
  return `${n}${suffix}`;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 55) return "text-gold-400";
  if (score >= 45) return "text-text-secondary";
  if (score >= 30) return "text-amber-500";
  return "text-rose-400";
}

function directionStyle(dir: SignalDirection) {
  return dir === "bullish"
    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
    : "bg-rose-500/15 text-rose-400 border border-rose-500/30";
}

function confidenceStyle(c: ConfidenceLevel) {
  if (c === "high")   return "bg-gold-400/10 text-gold-400 border border-gold-400/20";
  if (c === "medium") return "bg-navy-700/60 text-text-secondary border border-navy-600";
  return "bg-navy-700/40 text-text-muted border border-navy-600/50";
}

function barColor(value: number): string {
  if (value >= 70) return "bg-emerald-500";
  if (value >= 55) return "bg-gold-400/80";
  if (value >= 45) return "bg-navy-500";
  if (value >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

function probLabel(p: number): string {
  const pct = Math.round(p * 100);
  if (pct >= 70) return `${pct}% likely positive`;
  if (pct >= 50) return `${pct}% likely positive`;
  return `${100 - pct}% likely negative`;
}

function probColor(p: number): string {
  const pct = p * 100;
  if (pct >= 65) return "text-emerald-400";
  if (pct >= 50) return "text-gold-400";
  return "text-rose-400";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className={`font-mono font-medium ${scoreColor(value)}`}>{value}</span>
      </div>
      <div className="h-1.5 bg-navy-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="text-right text-[10px] text-text-muted">
        {Math.round(weight * 100)}% weight
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-navy-700/50 rounded-lg p-3 space-y-0.5">
      <div className="text-[10px] uppercase tracking-widest text-text-muted">{label}</div>
      <div className={`font-mono text-sm font-medium ${accent ?? "text-text-primary"}`}>{value}</div>
      {sub && <div className="text-[11px] text-text-secondary">{sub}</div>}
    </div>
  );
}

// ── Projection range bar ──────────────────────────────────────────────────────

function ProjectionBar({
  worst,
  expected,
  best,
}: {
  worst:    number;
  expected: number;
  best:     number;
}) {
  // Normalise positions to [0, 100] range for the bar
  const min = Math.min(worst, -10);
  const max = Math.max(best, 10);
  const span = max - min;

  const pos = (v: number) => clamp(((v - min) / span) * 100, 0, 100);
  const worstPx  = pos(worst);
  const expectedPx = pos(expected);
  const bestPx   = pos(best);
  const zeroPx   = pos(0);

  return (
    <div className="space-y-2">
      {/* Range bar */}
      <div className="relative h-2 bg-navy-700 rounded-full overflow-hidden">
        {/* Confidence band */}
        <div
          className="absolute h-full bg-navy-500/50 rounded-full"
          style={{
            left:  `${worstPx}%`,
            width: `${bestPx - worstPx}%`,
          }}
        />
        {/* Expected marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-gold-400"
          style={{ left: `${expectedPx}%` }}
        />
        {/* Zero marker */}
        <div
          className="absolute top-0 h-full w-px bg-navy-600"
          style={{ left: `${zeroPx}%` }}
        />
      </div>
      {/* Labels */}
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-rose-400">{worst > 0 ? "+" : ""}{worst}%</span>
        <span className="text-gold-400 font-medium">
          {expected > 0 ? "+" : ""}{expected}% expected
        </span>
        <span className="text-emerald-400">+{best > 0 ? best : 0}%</span>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function SignalCard({ signal }: { signal: SignalScore }) {
  const { ticker, score, direction, confidence, breakdown, metrics, projection } = signal;

  const ratingColor =
    metrics.analystRating === "Buy"  ? "text-emerald-400" :
    metrics.analystRating === "Sell" ? "text-rose-400"    : "text-text-secondary";

  return (
    <div className="bg-navy-800 border border-navy-600 rounded-2xl p-5 space-y-5 hover:border-navy-500 transition-colors">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-semibold text-text-primary">{ticker}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${directionStyle(direction)}`}>
              {direction === "bullish" ? "▲ Bullish" : "▼ Bearish"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${confidenceStyle(confidence)}`}>
              {confidence} conviction
            </span>
          </div>
        </div>
        {/* Composite score ring */}
        <div className="flex flex-col items-center shrink-0">
          <div className={`font-display text-3xl font-medium ${scoreColor(score)}`}>
            {score}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mt-0.5">Score</div>
        </div>
      </div>

      {/* ── Score breakdown ── */}
      <div className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-text-muted">Score Breakdown</div>
        <ScoreBar label="Price Momentum"     value={breakdown.priceMomentum.value}    weight={breakdown.priceMomentum.weight}    />
        <ScoreBar label="Analyst Consensus"  value={breakdown.analystConsensus.value} weight={breakdown.analystConsensus.weight} />
        <ScoreBar label="Valuation"          value={breakdown.valuation.value}        weight={breakdown.valuation.weight}        />
        <ScoreBar label="News Sentiment"     value={breakdown.newsSentiment.value}    weight={breakdown.newsSentiment.weight}    />
      </div>

      {/* ── Key metrics grid ── */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-widest text-text-muted">Key Metrics</div>
        <div className="grid grid-cols-3 gap-2">
          <MetricCell
            label="52w Return"
            value={metrics.totalReturn52w !== null ? `+${metrics.totalReturn52w}%` : "—"}
            accent={metrics.totalReturn52w !== null && metrics.totalReturn52w > 0 ? "text-emerald-400" : "text-rose-400"}
          />
          <MetricCell
            label="Sharpe"
            value={metrics.sharpeEstimate !== null ? `${metrics.sharpeEstimate}` : "—"}
            sub="risk-adj."
            accent={
              metrics.sharpeEstimate === null ? undefined :
              metrics.sharpeEstimate >= 1 ? "text-emerald-400" :
              metrics.sharpeEstimate >= 0 ? "text-gold-400"    : "text-rose-400"
            }
          />
          <MetricCell
            label="P/E"
            value={metrics.peRatio !== null ? `${metrics.peRatio}×` : "—"}
          />
          <MetricCell
            label="PEG"
            value={metrics.pegRatio !== null ? `${metrics.pegRatio}` : "—"}
            sub={metrics.pegRatio !== null ? (metrics.pegRatio < 1 ? "undervalued" : metrics.pegRatio < 2 ? "fair" : "stretched") : undefined}
            accent={
              metrics.pegRatio === null ? undefined :
              metrics.pegRatio < 1   ? "text-emerald-400" :
              metrics.pegRatio < 2   ? "text-gold-400"    : "text-rose-400"
            }
          />
          <MetricCell
            label="Analyst"
            value={metrics.analystRating ?? "—"}
            accent={ratingColor}
          />
          <MetricCell
            label="Target"
            value={metrics.analystTarget !== null ? `$${metrics.analystTarget}` : "—"}
            sub={metrics.upsidePct !== null ? `${metrics.upsidePct > 0 ? "+" : ""}${metrics.upsidePct}% upside` : undefined}
            accent={metrics.upsidePct !== null && metrics.upsidePct > 0 ? "text-emerald-400" : undefined}
          />
        </div>
      </div>

      {/* ── 30-day statistical projection ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-widest text-text-muted">30-Day Projection</div>
          <div className="text-[11px] text-text-muted">90% confidence interval</div>
        </div>
        <ProjectionBar
          worst={projection.worstCasePct}
          expected={projection.expectedReturnPct}
          best={projection.bestCasePct}
        />
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className={`font-medium ${probColor(projection.probPositive)}`}>
              {probLabel(projection.probPositive)}
            </span>
          </div>
          <span className="text-text-muted font-mono">
            ~{projection.annualVolPct}% ann. vol
          </span>
        </div>
      </div>
    </div>
  );
}
