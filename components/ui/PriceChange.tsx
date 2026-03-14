interface PriceChangeProps {
  change: number;
  changePct: number;
  showAbsolute?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClass = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
};

export default function PriceChange({
  change,
  changePct,
  showAbsolute = false,
  size = "md",
}: PriceChangeProps) {
  const positive = changePct >= 0;
  const color = positive ? "text-emerald-400" : "text-red-400";
  const sign = positive ? "+" : "";

  return (
    <span className={`font-mono tabular-nums ${color} ${sizeClass[size]}`}>
      {showAbsolute && (
        <span className="mr-1">
          {sign}{Math.abs(change).toFixed(2)}
        </span>
      )}
      <span>
        ({sign}{changePct.toFixed(2)}%)
      </span>
    </span>
  );
}
