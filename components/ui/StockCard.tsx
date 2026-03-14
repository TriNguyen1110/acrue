import { Chip, Button } from "@heroui/react";
import PriceChange from "./PriceChange";
import type { WatchlistItem } from "@/types";

interface StockCardProps {
  item: WatchlistItem;
  onRemove: (ticker: string) => void;
  removing?: boolean;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function peBucket(pe: number | null): string | null {
  if (!pe || pe <= 0) return null;
  if (pe < 15)  return `P/E ${pe.toFixed(1)} · Value`;
  if (pe < 30)  return `P/E ${pe.toFixed(1)} · Growth`;
  if (pe < 60)  return `P/E ${pe.toFixed(1)} · High Growth`;
  return `P/E ${pe.toFixed(1)} · Speculative`;
}

function week52Position(price: number, low: number | null, high: number | null): string | null {
  if (!low || !high || high === low) return null;
  const pct = (price - low) / (high - low);
  if (pct >= 0.95) return "Near 52W High";
  if (pct <= 0.05) return "Near 52W Low";
  return null;
}

function marketCapTier(v: number | null): string | null {
  if (!v) return null;
  if (v >= 1_000_000_000_000) return ">$1T Cap";
  if (v >= 200_000_000_000)   return ">$200B Cap";
  if (v >= 10_000_000_000)    return ">$10B Cap";
  if (v >= 2_000_000_000)     return ">$2B Cap";
  if (v >= 300_000_000)       return ">$300M Cap";
  return "<$300M Cap";
}

function formatMarketCap(v: number | null): string {
  if (!v) return "—";
  if (v >= 1_000_000_000_000) return `$${(v / 1_000_000_000_000).toFixed(1)}T`;
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

const marketStateChip: Record<
  string,
  { label: string; color: "success" | "warning" | "primary" | "default" }
> = {
  REGULAR: { label: "LIVE",   color: "success" },
  PRE:     { label: "PRE",    color: "warning" },
  POST:    { label: "AH",     color: "primary" },
  CLOSED:  { label: "CLOSED", color: "default" },
};

export default function StockCard({ item, onRemove, removing }: StockCardProps) {
  const { quote, sector } = item;

  const week52Range =
    quote.week52High && quote.week52Low
      ? ((quote.price - quote.week52Low) / (quote.week52High - quote.week52Low)) * 100
      : null;

  const stateChip = marketStateChip[quote.marketState] ?? marketStateChip.CLOSED;

  return (
    <tr className="border-b border-navy-600 last:border-0 hover:bg-navy-700/40 transition-colors group">
      {/* Ticker + Name */}
      <td className="py-3 px-4">
        <div className="font-mono text-sm font-medium text-gold-400">{quote.ticker}</div>
        <div className="text-xs text-text-secondary truncate max-w-[160px] mb-1">{quote.name}</div>
        <div className="flex items-center gap-1 flex-wrap mt-1">
          {[
            sector,
            marketCapTier(quote.marketCap),
            quote.exchange || null,
            peBucket(quote.pe),
            week52Position(quote.price, quote.week52Low, quote.week52High),
            quote.quoteType === "ETF" ? "ETF" : null,
          ]
            .filter(Boolean)
            .map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-navy-700 text-text-muted px-1.5 py-0.5 rounded-full border border-navy-600 whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
        </div>
      </td>

      {/* Price */}
      <td className="py-3 px-4 text-right">
        <span className="font-mono text-sm text-text-primary">
          ${quote.price.toFixed(2)}
        </span>
      </td>

      {/* Change */}
      <td className="py-3 px-4 text-right">
        <PriceChange change={quote.change} changePct={quote.changePct} showAbsolute size="sm" />
      </td>

      {/* Avg Volume */}
      <td className="py-3 px-4 text-right">
        <span className="font-mono text-xs text-text-secondary">
          {quote.avgVolume > 0 ? formatVolume(quote.avgVolume) : "—"}
        </span>
      </td>

      {/* Market Cap */}
      <td className="py-3 px-4 text-right">
        <span className="font-mono text-xs text-text-secondary">
          {formatMarketCap(quote.marketCap)}
        </span>
      </td>

      {/* 52W Range */}
      <td className="py-3 px-4">
        {week52Range !== null ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-text-muted w-10 text-right">
              ${quote.week52Low?.toFixed(0)}
            </span>
            <div className="flex-1 h-1 bg-navy-600 rounded-full relative min-w-[60px]">
              <div
                className="absolute top-0 left-0 h-full bg-gold-600 rounded-full"
                style={{ width: `${Math.min(Math.max(week52Range, 2), 100)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-text-muted w-10">
              ${quote.week52High?.toFixed(0)}
            </span>
          </div>
        ) : (
          <span className="text-text-muted text-xs">—</span>
        )}
      </td>

      {/* Market State */}
      <td className="py-3 px-4">
        <Chip
          size="sm"
          variant="flat"
          color={stateChip.color}
          classNames={{ base: "h-5", content: "text-[10px] font-medium px-1" }}
        >
          {stateChip.label}
        </Chip>
      </td>

      {/* Remove */}
      <td className="py-3 px-4 text-right">
        <Button
          isIconOnly
          size="sm"
          variant="light"
          color="danger"
          isLoading={removing}
          onPress={() => onRemove(quote.ticker)}
          className="min-w-6 w-6 h-6"
          aria-label={`Remove ${quote.ticker}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </Button>
      </td>
    </tr>
  );
}
