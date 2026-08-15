import { formatMoney } from "@/lib/format";

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

/**
 * Rev 05 §3.1: a true full-bleed banner — black, skinny, edge to edge
 * across the full screen width, not a rounded card contained by the
 * layout's max-width. Breaks out of the centered <main> via the classic
 * 100vw + negative-margin trick.
 */
export function TickerBar({ indices }: { indices: TickerIndex[] }) {
  if (indices.length === 0) return null;

  return (
    <div className="relative left-1/2 -ml-[50vw] w-screen bg-ink">
      <div className="mx-auto flex h-10 max-w-[1440px] items-center justify-evenly px-6 md:px-10">
        {indices.map((idx) => {
          const delta = idx.value - idx.prev_close;
          const pct = idx.prev_close !== 0 ? (delta / idx.prev_close) * 100 : 0;
          const up = delta >= 0;
          return (
            <div key={idx.symbol} className="flex items-center gap-2 text-[12px]">
              <span className="text-bg/60">{idx.label}</span>
              <span className="text-bg tabular-nums">{formatValue(idx)}</span>
              <span className={`tabular-nums ${up ? "text-good" : "text-bad"}`}>
                {up ? "▲" : "▼"} {Math.abs(pct).toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
