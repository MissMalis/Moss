import { formatMoney } from "@/lib/format";
import { CARD } from "@/lib/ui";

export interface TickerIndex {
  symbol: string;
  label: string;
  value: number;
  prev_close: number;
}

function formatValue(idx: TickerIndex): string {
  // The 10-year yield is a rate, not a price — no dollar sign.
  if (idx.symbol === "US10Y") return `${idx.value.toFixed(2)}%`;
  return formatMoney(idx.value);
}

/** Rev 04 §2.1: a full-width card, indices evenly spaced with hairline dividers. Delayed/auto-refreshing. */
export function TickerBar({ indices }: { indices: TickerIndex[] }) {
  if (indices.length === 0) return null;

  return (
    <div className={`${CARD} flex flex-wrap items-stretch divide-x divide-border p-0`}>
      {indices.map((idx) => {
        const delta = idx.value - idx.prev_close;
        const pct = idx.prev_close !== 0 ? (delta / idx.prev_close) * 100 : 0;
        const up = delta >= 0;
        return (
          <div key={idx.symbol} className="flex flex-1 basis-[150px] items-center gap-2 px-4 py-3 text-[12.5px]">
            <span className="text-ink-3">{idx.label}</span>
            <span className="text-ink tabular-nums">{formatValue(idx)}</span>
            <span className={`tabular-nums ${up ? "text-good" : "text-bad"}`}>
              {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
