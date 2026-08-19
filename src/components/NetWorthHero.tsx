"use client";

import { useState } from "react";
import { NetWorthLines } from "@/components/NetWorthLines";
import { Money } from "@/components/Money";
import { filterByRange, computeDeltas, type RangeKey } from "@/lib/net-worth-range";
import { formatMoney } from "@/lib/format";
import type { HistoryPoint } from "@/lib/net-worth";
import { CARD, CARD_HEADER } from "@/lib/ui";

const RANGES: RangeKey[] = ["3M", "6M", "1Y", "ALL"];

export function NetWorthHero({ total, points }: { total: number; points: HistoryPoint[] }) {
  const [range, setRange] = useState<RangeKey>("6M");
  const rangePoints = filterByRange(points, range);
  const deltas = computeDeltas(points, rangePoints);

  return (
    <section className={`${CARD} flex h-full flex-col`}>
      <div className="flex items-start justify-between gap-3">
        <p className={CARD_HEADER}>Net worth</p>
        <div className="flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition ${
                range === r ? "bg-moss-bg text-moss" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <Money value={total} size="section" className="mt-2" />

      {/* Rev 09 §2.4: one delta for the selected timeframe — $ and %,
          same sign/color/arrow, no date suffix. Legend moved into
          NetWorthLines itself (bottom-centered, under the plot). */}
      {deltas && (
        <p className={`mt-1.5 text-[13.5px] font-medium ${deltas.rangeAbs >= 0 ? "text-good" : "text-bad"}`}>
          {deltas.rangeAbs >= 0 ? "▲" : "▼"} {deltas.rangeAbs >= 0 ? "+" : "−"}
          {formatMoney(Math.abs(deltas.rangeAbs))} · {deltas.rangeAbs >= 0 ? "+" : "−"}
          {Math.abs(deltas.rangePct).toFixed(1)}%
        </p>
      )}

      <div className="mt-3 flex-1 -mx-4">
        <NetWorthLines points={rangePoints} variant="full" />
      </div>
    </section>
  );
}
