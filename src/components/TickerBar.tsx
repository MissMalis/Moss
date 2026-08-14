import { formatMoney } from "@/lib/format";

export interface TickerIndex {
  symbol: string;
  label: string;
  value: number;
  prev_close: number;
}

/** Today §2.1: a single thin strip, not boxes. Delayed/auto-refreshing market data — no "delayed" label. */
export function TickerBar({ indices }: { indices: TickerIndex[] }) {
  if (indices.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12.5px]">
      {indices.map((idx) => {
        const delta = idx.value - idx.prev_close;
        const pct = idx.prev_close !== 0 ? (delta / idx.prev_close) * 100 : 0;
        const up = delta >= 0;
        return (
          <span key={idx.symbol} className="flex items-center gap-1.5">
            <span className="text-ink-3">{idx.label}</span>
            <span className="text-ink tabular-nums">{formatMoney(idx.value)}</span>
            <span className={`tabular-nums ${up ? "text-good" : "text-bad"}`}>
              {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
            </span>
          </span>
        );
      })}
    </div>
  );
}
