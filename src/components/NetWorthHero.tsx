"use client";

import { useState } from "react";
import { NetWorthLines } from "@/components/NetWorthLines";
import { Money } from "@/components/Money";
import { filterByRange, computeDeltas, type RangeKey } from "@/lib/net-worth-range";
import { formatMoney, formatShortDateLabel } from "@/lib/format";
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

      {deltas && (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[13.5px] text-ink-2">
          <span className={deltas.allTimePct >= 0 ? "text-good" : "text-bad"}>
            {deltas.allTimePct >= 0 ? "▲" : "▼"} {Math.abs(deltas.allTimePct).toFixed(1)}% all time
          </span>
          <span className={deltas.rangeAbs >= 0 ? "text-good" : "text-bad"}>
            {deltas.rangeAbs >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(deltas.rangeAbs))} on{" "}
            {formatShortDateLabel(deltas.rangeDate)}
          </span>
        </p>
      )}

      {/* Rev 08 #4: legend sits above-right of the graph (was a
          left-aligned row that read as top-left-over-the-plot). */}
      <div className="mt-4 flex items-center justify-end gap-3 text-[12px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-3 rounded-full bg-good" aria-hidden />
          Market value
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-3 rounded-full bg-contributed" aria-hidden />
          Contribution
        </span>
      </div>

      <div className="mt-2 flex-1 -mx-4">
        <NetWorthLines points={rangePoints} variant="full" />
      </div>
    </section>
  );
}
